# Arade — Go-Live Checklist

Last updated: 2026-09-29 (after first production deploy of Canada Post + welcome-email work).

---

## 1. What shipped (commits 917a6ac..2ab491e on `main`)

- **Canada Post integration** (modern Developer Portal APIs only — OAuth 2.0 client-credentials):
  live checkout rates (Rating 4.0.0), admin shipment + label (Shipping 8.0.0),
  live customer tracking (Tracking 2.0.0). No flat-rate fallback: Canada Post
  failures surface as controlled errors.
- **Welcome coupon email** sent only AFTER email verification, once per user,
  guarded by `profiles.welcome_email_sent_at`. Auto-recovery for verified users
  who never got it (fires once on `/account`), manual resend button there too.
- **Resend confirmation email** flow on the login page for unverified accounts.
- **First-order coupon enforcement at payment time** (Stripe + PayPal run the
  full eligibility context: order history, address-match defense, 30-day window
  anchored to the welcome email). Checkout page sends the session token when
  applying coupons manually.

## 2. Supabase migrations (SQL Editor) — ALL APPLIED ✅

Run order matters only conceptually; all three are idempotent (safe to re-run):

| Migration | What it does | Status |
|---|---|---|
| `supabase/migrations/20260104_canada_post_shipping.sql` | `products.weight_grams` (default 250 g); `orders.shipping_method_code`, `shipping_method_name`, `tracking_number`, `label_url` | ✅ Applied 2026-09-29 |
| `supabase/migrations/20260105_welcome_email_flag.sql` | `profiles.welcome_email_sent_at` (send-once guard) | ✅ Applied |
| `supabase/migrations/20260106_welcome_coupon_30_days.sql` | Sets active first-order coupons to expire 30 days after issue | ✅ Applied (WELCOME20 = 30) |

**Rule: run SQL migrations BEFORE deploying dependent code** (Vercel redeploys
automatically on push).

## 3. Environment variables

### Vercel (Production) — REQUIRED for checkout
Added 2026-09-29. Values live in local `.env.local`; never paste secrets in chat.

```
CANADAPOST_API_KEY          # Developer Portal app "Arade Test Shipping" (ends 85a6)
CANADAPOST_SECRET_KEY
CANADAPOST_CUSTOMER_NUMBER  # SMB account 0001221118
CANADAPOST_ORIGIN_NAME
CANADAPOST_ORIGIN_ADDRESS
CANADAPOST_ORIGIN_CITY
CANADAPOST_ORIGIN_PROVINCE
CANADAPOST_ORIGIN_POSTAL
CANADAPOST_ORIGIN_PHONE
```

Already present (verify they're still there): `BREVO_API_KEY`,
`ORDER_NOTIFICATION_EMAIL`, `NEXT_PUBLIC_SITE_URL`, Supabase URL/keys,
Stripe + PayPal sandbox keys.

NOT needed on Vercel:
- `CANADAPOST_CONTRACT_ID` / `CANADAPOST_CONTRACT_NUMBER` — only for commercial
  contract accounts. Without it, settlement defaults to **CreditCard** (correct
  for the SMB account).
- `CANADAPOST_API_USERNAME` / `CANADAPOST_API_PASSWORD` — legacy Basic-auth
  leftovers, unused by the new code. Never use soa-gw/legacy endpoints.
- `CANADAPOST_SANDBOX` — informational only; it does NOT change the endpoint.

After adding/changing any var: **Redeploy** (Deployments → latest → Redeploy).

## 4. Supabase Auth → URL Configuration

- **Site URL:** `https://www.aradeshop.com`
- **Redirect URLs must include:**
  - `https://www.aradeshop.com/**` (production)
  - `http://localhost:3000/**` (local dev — otherwise signup confirm bounces to prod)

Status: production confirm-email → callback → `/account` flow verified live
2026-09-29. ✅

## 5. Brevo (transactional email)

- Sender `support@aradeshop.com` currently shows **NOT verified** in the Brevo
  dashboard even though emails deliver. → **Verify the sender** (SPF/DKIM) so
  deliverability never degrades.
- **Free plan ≈ 300 emails/day.** Order confirmations + owner copies + welcome
  emails all count. Watch the credit counter as launch volume grows; upgrade
  before the cap starts biting.

## 6. Canada Post — current state and production switch plan

**Current (Test):**
- Portal app "Arade Test Shipping", Test credential in use (key ends `85a6`).
  Stubbed data, **no billing ever**.
- Subscriptions on default plan: Rating 4.0.0 ✅, Shipping 8.0.0 ✅,
  Tracking 2.0.0 ✅ (401s resolve ~2 min after subscribing).
- Sandbox tracking always returns PIN error `004` "No PIN History" — expected;
  real scans only exist in production.
- **Shipment creation is the ONLY card-gated step.** Canada Post accepts real
  Visa/MC/Amex credit cards only (Visa Debit/prepaid fail). Errors 9174 (no
  default card) and 1182 (card not authorized) have friendly hints in
  `src/lib/canadapost.ts`. Nothing is charged while on the Test credential.
- **PROVEN no card-free workaround exists (2026-09-29 probe):** our request
  uses `transmitShipment: true` (SMB immediate-purchase path) which validates
  the profile's default card even on the Test app. The alternative
  manifest/group mode (`transmitShipment: false` + groupId) was probed live
  via `scripts/probe-transmit-false.mjs` and Canada Post rejected it with
  **error 7302: "A Small/Medium Business must pay for each label (cannot use
  a manifest)"**. Conclusion: the client's real default Visa/MC/Amex is
  REQUIRED before any label can be created, even for testing. Do not retry
  manifest mode or add workaround flags for this account.

**Switch to production (when going live with real shipments):**
1. In the Developer Portal, take the **[Production] credential** (key
   `4991950754b9a8178639fa167f8468fc` — value also visible in the user's portal
   screenshot; never commit it).
2. On the production app, subscribe the same three APIs (Rating 4.0.0,
   Shipping 8.0.0, Tracking 2.0.0) and wait for subscriptions to go live.
3. Ensure a **real credit card is the default payment method** on the Canada
   Post profile (client's card — pending).
4. In Vercel, swap `CANADAPOST_API_KEY` (+ secret if the prod app has its own)
   to the production values → Redeploy.
5. Re-run `node scripts/diagnose-cp-rates.mjs` with the prod values locally to
   confirm token/rates/tracking return 200 before announcing.
6. From then on, **real shipments create real charges** — the sandbox test
   shipment test must happen BEFORE the switch, or use a known-good test order.

## 7. Verification log

Verified 2026-09-29 (local + production):
- ✅ Signup → confirm email → lands on `/account`, welcome coupon email sent
  once (Brevo event "Welcome to Arade – 20% OFF" delivered; user opened it).
- ✅ `/account` auto-sends the welcome email to verified users missing it;
  manual resend button present.
- ✅ Resend-confirmation API live (generic 200, no account-enumeration).
- ✅ Orders/shipping columns present in Supabase; new APIs respond (401/400/307
  as designed) in production.
- ✅ Typecheck clean; 16 Canada Post unit tests pass.

**Outstanding tests:**
- [ ] Live checkout: Canadian address shows real Canada Post rates; WELCOME20
  applies (auto + manual).
- [ ] E2E shipment: order `ARD-MULMNE4P-HQ52` (QC H3B 1A2) — blocked on the
  client's credit card. After Create Shipment: verify label PDF, tracking PIN
  saved, order status flip, shipped email, live tracking card. Old order
  `ARD-MUJRTJXD-MVC1` is unusable (invalid NT+M5V2T6 postal).

## 8. Known quirks

- Seeing "Something went wrong" right after a deploy = caught mid-swap; a
  refresh fixes it (happened once during the 2026-09-29 deploy).
- All work lives on `main`; repo history is clean (no commit footers).
- Diagnostics (safe, no secrets printed): `node scripts/diagnose-cp-rates.mjs`,
  `node scripts/diagnose-welcome-email.mjs`.
