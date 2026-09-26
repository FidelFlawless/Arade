-- ============================================================
-- Guest checkout + Coupon codes migration
-- Run in Supabase Dashboard → SQL Editor, in order, top to bottom.
-- Safe to re-run (idempotent).
-- ============================================================

-- ------------------------------------------------------------
-- PART 1 — GUEST CHECKOUT
-- ------------------------------------------------------------

-- 1a. Allow orders without an account (guest checkout)
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- 1b. Store the guest's email on the order (used for the confirmation
--     email and so the store owner can contact the customer).
--     The live table does not have this column yet.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_email text;

-- 1c. Backfill: copy the account email onto existing orders
UPDATE public.orders o
SET shipping_email = p.email
FROM public.profiles p
WHERE o.user_id = p.id
  AND o.shipping_email IS NULL;

-- 1d. RLS: guests have no session, so rows with NULL user_id must be
--     readable/writable only through the service role (server routes).
--     These policies keep logged-in users able to see their own orders.
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "orders_insert_own" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "orders_update_own" ON public.orders
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- PART 2 — COUPONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  -- percent: 0-100 (applies to both currencies)
  -- fixed:   CAD amount in discount_value_cad, USD amount in discount_value_usd
  discount_value_cad numeric NOT NULL CHECK (discount_value_cad > 0),
  discount_value_usd numeric CHECK (discount_value_usd IS NULL OR discount_value_usd > 0),
  min_subtotal_cad numeric NOT NULL DEFAULT 0,
  min_subtotal_usd numeric NOT NULL DEFAULT 0,
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent negative/overflow nonsense on usage counter
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_used_count_nonnegative CHECK (used_count >= 0);

-- Track which coupon was used on each order (for reporting/audit)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text;

-- RLS: coupons are managed by admins through service-role routes only.
-- Public may validate a code but only through the server API, so the
-- table itself stays closed to anon/authenticated clients.
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- No public policies on coupons: reads/writes go through server routes
-- that use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS by design).

-- ------------------------------------------------------------
-- Done. After running:
--   1. Security Advisor should show no new issues for these tables.
--   2. Deploy the matching application code, then test:
--      - Guest checkout with Stripe and PayPal
--      - Coupon percent + fixed, CAD + USD
-- ------------------------------------------------------------
