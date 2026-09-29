import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  isValidEmail,
  isValidNorthAmericanPhone,
  isValidShippingPostalCode,
  isValidShippingRegion,
} from "@/lib/utils";
import { validateCoupon, recordCouponUsage } from "@/lib/coupons";
import { getCanadaPostRates, CanadaPostError } from "@/lib/canadapost";

const DEFAULT_ITEM_WEIGHT_GRAMS = 250;

function getStripe() {
  const rawKey = process.env.STRIPE_SECRET_KEY || "";
  const cleanKey = rawKey.trim().replace(/^["']|["']$/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, "");
  if (!cleanKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured in environment variables");
  }
  return new Stripe(cleanKey, {
    maxNetworkRetries: 2,
    timeout: 30000,
  });
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const body = await req.json();
    const { userId, items, shippingAddress, country, currency, couponCode, shippingMethod } = body;

    // 1. Guest checkout: authentication is OPTIONAL. If a userId and bearer
    // token are provided, verify the token actually belongs to that user
    // (never trust the body alone). Guests proceed without either.
    const authHeader = req.headers.get("authorization");
    // Verified caller identity + welcome-email flag, used for first-order
    // coupon eligibility (history, address-match, expiry window).
    let verifiedUser: { id: string; email?: string; created_at?: string } | null = null;
    let verifiedProfile: { welcome_email_sent_at: string | null } | null = null;
    if (userId) {
      if (!authHeader) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      // Pass the JWT explicitly - global headers are not honoured by getUser()
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
      if (authError || !user || user.id !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      verifiedUser = { id: user.id, email: user.email, created_at: user.created_at };
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("welcome_email_sent_at")
        .eq("id", userId)
        .maybeSingle();
      verifiedProfile = profile ?? null;
    }

    // 2. Validate inputs
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    if (!shippingAddress || !country) {
      return NextResponse.json({ error: "Shipping address required" }, { status: 400 });
    }

    if (country !== "CA" && country !== "US") {
      return NextResponse.json({ error: "Only Canada and USA are supported" }, { status: 400 });
    }

    if (
      !shippingAddress.first_name?.trim() ||
      !shippingAddress.last_name?.trim() ||
      !isValidEmail(shippingAddress.email || "") ||
      !shippingAddress.address_line1?.trim() ||
      !shippingAddress.city?.trim() ||
      !isValidShippingRegion(country, shippingAddress.province_state || "") ||
      !isValidShippingPostalCode(country, shippingAddress.postal_code || "")
    ) {
      return NextResponse.json({ error: "Please provide a complete and valid shipping address" }, { status: 400 });
    }

    if (!shippingAddress.phone || !isValidNorthAmericanPhone(shippingAddress.phone)) {
      return NextResponse.json(
        { error: "A valid Canada or United States phone number is required" },
        { status: 400 }
      );
    }

    // 3. Fetch actual prices from database (NEVER trust browser prices)
    const productIds = items.map((item: { productId: string }) => item.productId);
    const { data: dbProducts, error: dbError } = await supabaseAdmin
      .from("products")
      .select("id, name, price_cad, price_usd, stock_quantity, is_active, image_url")
      .in("id", productIds)
      .eq("is_active", true);

    if (dbError || !dbProducts) {
      return NextResponse.json({ error: "Failed to verify products" }, { status: 500 });
    }

    // 4. Build validated items with server-side prices
    const validatedItems: Array<{
      productId: string;
      name: string;
      quantity: number;
      serverPrice: number;
      image: string | null;
    }> = [];

    let subtotal = 0;

    for (const item of items) {
      const dbProduct = dbProducts.find((p) => p.id === item.productId);

      if (!dbProduct) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found or unavailable` },
          { status: 400 }
        );
      }

      if (dbProduct.stock_quantity < item.quantity) {
        return NextResponse.json(
          { error: `${dbProduct.name} only has ${dbProduct.stock_quantity} in stock` },
          { status: 400 }
        );
      }

      const serverPrice = currency === "CAD" ? dbProduct.price_cad : dbProduct.price_usd;
      subtotal += serverPrice * item.quantity;

      validatedItems.push({
        productId: dbProduct.id,
        name: dbProduct.name,
        quantity: item.quantity,
        serverPrice,
        image: dbProduct.image_url,
      });
    }

    // 5. Delivery fee: live Canada Post rate for the customer's chosen
    // service, re-quoted SERVER-SIDE (never trust the browser's price).
    // No flat-rate fallback: on Canada Post failure we return a controlled
    // error and the customer can retry.
    if (!shippingMethod || typeof shippingMethod.code !== "string") {
      return NextResponse.json(
        { error: "Please choose a shipping option" },
        { status: 400 }
      );
    }

    let deliveryFee = 0;
    let shippingMethodName = shippingMethod.code;
    try {
      const productIds = items.map((item: { productId: string }) => item.productId);
      const { data: weightRows } = await supabaseAdmin
        .from("products")
        .select("id, weight_grams")
        .in("id", productIds);
      const totalWeightKg =
        items.reduce((sum: number, item: { productId: string; quantity: number }) => {
          const row = weightRows?.find((w) => w.id === item.productId);
          const grams = (row?.weight_grams ?? DEFAULT_ITEM_WEIGHT_GRAMS) * item.quantity;
          return sum + grams;
        }, 0) / 1000;

      const rates = await getCanadaPostRates({
        destinationCountry: country,
        destinationPostalCode: shippingAddress.postal_code,
        weightKg: totalWeightKg,
      });
      const chosen = rates.find((r) => r.serviceCode === shippingMethod.code);
      if (!chosen) {
        return NextResponse.json(
          { error: "The selected shipping option is no longer available. Please pick another one." },
          { status: 400 }
        );
      }
      deliveryFee = chosen.price;
      shippingMethodName = chosen.serviceName;
    } catch (err) {
      if (err instanceof CanadaPostError) {
        console.error("Canada Post checkout rates error:", err.message);
        return NextResponse.json(
          { error: "Shipping is temporarily unavailable. Please try again in a moment." },
          { status: 502 }
        );
      }
      throw err;
    }

    const total = Math.round((subtotal + deliveryFee) * 100) / 100;

    // 6b. Coupon: validate server-side against the server-calculated subtotal.
    // First-order coupons get the full eligibility context here (the same
    // checks the validate endpoint runs) so they cannot be smuggled through
    // by calling the payment route directly.
    let discount = 0;
    let appliedCouponCode: string | null = null;
    if (couponCode && typeof couponCode === "string") {
      const couponResult = await validateCoupon(couponCode, currency, subtotal, {
        userId: verifiedUser?.id ?? null,
        userEmail: verifiedUser?.email || null,
        userCreatedAt: verifiedUser?.created_at || null,
        userWelcomeEmailSentAt: verifiedProfile?.welcome_email_sent_at ?? null,
        orderEmail: shippingAddress.email || null,
        shipping: {
          first_name: shippingAddress.first_name,
          last_name: shippingAddress.last_name,
          address_line1: shippingAddress.address_line1,
          postal_code: shippingAddress.postal_code,
        },
      });
      if (!couponResult.ok) {
        return NextResponse.json({ error: couponResult.error || "Invalid coupon" }, { status: 400 });
      }
      discount = couponResult.discount || 0;
      appliedCouponCode = couponResult.code || null;
    }

    // The customer pays (subtotal - discount) + delivery. Discount reduces the
    // product line items so Stripe's charged amount exactly matches the order total.
    const payableSubtotal = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
    const grandTotal = Math.round((payableSubtotal + deliveryFee) * 100) / 100;

    // 6. Build Stripe line items. When a coupon applies, the discount is
    // spread proportionally across product lines so the per-item amounts
    // stay consistent with the displayed order total.
    const discountRatio = subtotal > 0 ? Math.min(1, discount / subtotal) : 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedItems.map(
      (item) => {
        const discountedUnit = Math.round(item.serverPrice * (1 - discountRatio) * 100);
        return {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: item.name,
              ...(item.image && typeof item.image === "string" && item.image.startsWith("http")
                ? { images: [item.image] }
                : {}),
            },
            unit_amount: discountedUnit, // Stripe uses cents
          },
          quantity: item.quantity,
        };
      }
    );

    // Add delivery fee as a line item if > 0
    if (deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: "Delivery",
          },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      });
    }

    // 7. Create a pending order in our database before Stripe checkout
    const orderNumber = `ARD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId || null,
        order_number: orderNumber,
        subtotal,
        delivery_fee: deliveryFee,
        discount,
        total: grandTotal,
        currency,
        payment_status: "pending",
        order_status: "pending",
        shipping_email: shippingAddress.email || null,
        coupon_code: appliedCouponCode,
        shipping_method_code: shippingMethod.code,
        shipping_method_name: shippingMethodName,
        shipping_first_name: shippingAddress.first_name,
        shipping_last_name: shippingAddress.last_name,
        shipping_phone: shippingAddress.phone || null,
        shipping_country: country,
        shipping_address_line1: shippingAddress.address_line1,
        shipping_address_line2: shippingAddress.address_line2 || null,
        shipping_city: shippingAddress.city,
        shipping_state_province: shippingAddress.province_state,
        shipping_postal_code: shippingAddress.postal_code,
        country: country,
        shipping_address: {
          first_name: shippingAddress.first_name,
          last_name: shippingAddress.last_name,
          email: shippingAddress.email,
          phone: shippingAddress.phone,
          address_line1: shippingAddress.address_line1,
          address_line2: shippingAddress.address_line2,
          city: shippingAddress.city,
          province_state: shippingAddress.province_state,
          postal_code: shippingAddress.postal_code,
          country: country,
        },
      })
      .select("id, order_number")
      .single();

    if (orderError) {
      return NextResponse.json({ error: "Failed to create order", details: orderError.message }, { status: 500 });
    }

    // 8. Create order items
    const orderItems = validatedItems.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.serverPrice,
      subtotal: item.serverPrice * item.quantity,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      return NextResponse.json({ error: "Failed to create order items", details: itemsError.message }, { status: 500 });
    }

    // 9. Create Stripe Checkout Session
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aradeshop.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ...({ managed_payments: { enabled: false } } as Record<string, unknown>),
      customer_email: shippingAddress.email || undefined,
      line_items: lineItems,

      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        user_id: userId || "guest",
        coupon_code: appliedCouponCode || "",
      },
      success_url: `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout?cancelled=true`,
    });

    // 10. Update order with Stripe session ID
    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    console.error("Stripe checkout error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
