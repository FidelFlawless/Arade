import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CouponResult {
  ok: boolean;
  error?: string;
  code?: string;
  couponId?: string;
  discount?: number;
}

export interface CouponEligibilityContext {
  /** Authenticated user id, or null for guests. */
  userId?: string | null;
  /** Account email of the signed-in user, if known. */
  userEmail?: string | null;
  /** When the user's account was created (ISO string), if known. */
  userCreatedAt?: string | null;
  /** Shipping details from the current checkout, used for the address-match defense. */
  shipping?: {
    first_name?: string | null;
    last_name?: string | null;
    address_line1?: string | null;
    postal_code?: string | null;
  } | null;
}

/** Normalize a string for comparisons: lowercase, collapse whitespace, strip punctuation-only noise. */
function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * First-order-only coupon eligibility. Returns an error string when the
 * customer does NOT qualify, or null when they do / when the check cannot
 * apply. Fail-open philosophy: any internal problem here results in
 * "eligible" — the discount may slip through, but a payment is never
 * blocked or broken by this check.
 */
async function checkFirstOrderEligibility(
  coupon: {
    first_order_only: boolean | null;
    expires_days_after_signup: number | null;
  },
  ctx: CouponEligibilityContext
): Promise<string | null> {
  if (!coupon.first_order_only) return null;

  // Must be signed in — that is the entire point of the incentive.
  if (!ctx.userId) {
    return "This coupon is only available to signed-in customers on their first order";
  }

  try {
    // 1. Prior paid orders by account id or account email.
    const email = (ctx.userEmail || "").trim().toLowerCase();
    let historyQuery = supabaseAdmin
      .from("orders")
      .select("id")
      .eq("payment_status", "paid")
      .limit(1);
    if (email) {
      historyQuery = historyQuery.or(`user_id.eq.${ctx.userId},shipping_email.eq.${email}`);
    } else {
      historyQuery = historyQuery.eq("user_id", ctx.userId);
    }
    const { data: priorOrders, error: historyError } = await historyQuery;
    if (!historyError && priorOrders && priorOrders.length > 0) {
      return "This coupon is only valid on your first order";
    }

    // 2. Address-match defense: same name + street + postal code as a prior
    //    paid order → they have effectively ordered before under a new account.
    const firstName = normalize(ctx.shipping?.first_name);
    const lastName = normalize(ctx.shipping?.last_name);
    const street = normalize(ctx.shipping?.address_line1);
    const postal = normalize(ctx.shipping?.postal_code);
    if (street && postal) {
      const { data: addrMatches, error: addrError } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("payment_status", "paid")
        .ilike("shipping_address_line1", `%${street}%`)
        .limit(5);
      if (!addrError && addrMatches && addrMatches.length > 0) {
        const ids = addrMatches.map((o: { id: string }) => o.id);
        const { data: detailed, error: detailError } = await supabaseAdmin
          .from("orders")
          .select(
            "shipping_first_name, shipping_last_name, shipping_address_line1, shipping_postal_code"
          )
          .in("id", ids);
        if (!detailError && detailed) {
          const match = detailed.some((o: Record<string, string | null>) => {
            const priorPostal = normalize(o.shipping_postal_code);
            if (!priorPostal || priorPostal !== postal) return false;
            // Street must match meaningfully (normalized contains-check both ways
            // catches "90 Ed Ewert Avenue" vs "90 ed ewert").
            const priorStreet = normalize(o.shipping_address_line1);
            if (!priorStreet) return false;
            const streetMatches =
              priorStreet.includes(street) || street.includes(priorStreet);
            const name = `${firstName} ${lastName}`.trim();
            const priorName = `${normalize(o.shipping_first_name)} ${normalize(
              o.shipping_last_name
            )}`.trim();
            // Require name AND street AND postal to line up — a different
            // customer at a shared address (spouse, roommate) should not be
            // blocked, so name is required unless we have none on the checkout.
            if (!name || !priorName) return streetMatches;
            return streetMatches && (name === priorName || priorName.includes(name) || name.includes(priorName));
          });
          if (match) {
            return "This coupon is only valid on your first order";
          }
        }
      }
    }

    // 3. Signup window: expires N days after account creation.
    if (coupon.expires_days_after_signup && ctx.userCreatedAt) {
      const created = new Date(ctx.userCreatedAt).getTime();
      const windowMs = coupon.expires_days_after_signup * 24 * 60 * 60 * 1000;
      if (!Number.isNaN(created) && Date.now() > created + windowMs) {
        return "This welcome coupon has expired";
      }
    }

    return null;
  } catch (err) {
    // Fail-open: eligibility errors must never break checkout.
    console.error("first-order eligibility check failed (fail-open):", err);
    return null;
  }
}

/**
 * Server-side coupon validation shared by /api/coupons/validate and the
 * Stripe/PayPal payment routes. Always computes the discount from the
 * server-calculated subtotal — the browser never dictates the discount.
 */
export async function validateCoupon(
  rawCode: string,
  currency: "CAD" | "USD",
  serverSubtotal: number,
  eligibility?: CouponEligibilityContext
): Promise<CouponResult> {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "No coupon code provided" };

  const { data: coupon, error } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error || !coupon) return { ok: false, error: "Invalid coupon code" };
  if (!coupon.active) return { ok: false, error: "This coupon is no longer active" };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This coupon has expired" };
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return { ok: false, error: "This coupon has reached its usage limit" };
  }

  // First-order-only coupons: account history, address-match defense and
  // signup-window expiry. Fail-open — never blocks the payment itself.
  if (coupon.first_order_only && eligibility) {
    const eligibilityError = await checkFirstOrderEligibility(coupon, eligibility);
    if (eligibilityError) return { ok: false, error: eligibilityError };
  }

  const minSubtotal =
    currency === "USD" ? Number(coupon.min_subtotal_usd) || 0 : Number(coupon.min_subtotal_cad) || 0;
  if (serverSubtotal < minSubtotal) {
    return {
      ok: false,
      error: `This coupon requires a minimum subtotal of ${currency === "USD" ? "US$" : "C$"}${minSubtotal.toFixed(2)}`,
    };
  }

  let discount = 0;
  if (coupon.discount_type === "percent") {
    discount = (serverSubtotal * Number(coupon.discount_value_cad)) / 100;
  } else {
    const fixedValue =
      currency === "USD" ? Number(coupon.discount_value_usd) : Number(coupon.discount_value_cad);
    if (!fixedValue || fixedValue <= 0) {
      return { ok: false, error: `This coupon is not valid for ${currency} payments` };
    }
    discount = Math.min(fixedValue, serverSubtotal);
  }

  return {
    ok: true,
    code: coupon.code,
    couponId: coupon.id,
    discount: Math.round(discount * 100) / 100,
  };
}

/**
 * Increment a coupon's usage counter after a payment is confirmed.
 * Fire-and-forget safe: logs but never throws.
 */
export async function recordCouponUsage(code: string | null | undefined): Promise<void> {
  if (!code) return;
  try {
    const { data: coupon } = await supabaseAdmin
      .from("coupons")
      .select("id, used_count")
      .eq("code", code)
      .maybeSingle();
    if (!coupon) return;
    await supabaseAdmin
      .from("coupons")
      .update({ used_count: (coupon.used_count || 0) + 1 })
      .eq("id", coupon.id);
  } catch (err) {
    console.error("recordCouponUsage failed:", err);
  }
}
