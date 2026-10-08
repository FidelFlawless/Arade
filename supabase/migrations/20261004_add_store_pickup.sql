-- ============================================================================
-- Store Pickup / Click & Collect (Arade)
-- ============================================================================
-- Standalone migration. Safe to re-run (idempotent).
--
-- Summary of decisions for this session:
--   * Pickup store fields live directly on public.orders (no new lookup table
--     yet - pickup_store_id is nullable; the store will be looked up/validated
--     on the client side when a store is actually configured).
--   * Pickup = free, no Canada Post call, no tracking, no label, paid online
--     via Stripe/PayPal, fulfilled manually from the physical store.
--   * Pickup status flow: preparing -> picking -> ready -> picked_up, plus
--     optional cancelled.
-- ============================================================================

-- 1. Fulfillment method
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'shipping';

-- 2. Pickup status. NOT NULL DEFAULT 'preparing': shipping orders carry the
--    default value and it is ignored everywhere (the admin API refuses
--    pickup-status changes on non-pickup orders); pickup rows are always
--    written explicitly as 'preparing' at checkout, then move through
--    picking -> ready -> picked_up, plus optional cancelled.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_status text NOT NULL DEFAULT 'preparing';

-- 3. Pickup store configuration (extension point for now; admin supplies the
--    store name/address later via store_settings, not a new table).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_store_id uuid;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_store_name text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_address_line1 text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_address_line2 text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_city text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_state_province text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_postal_code text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_country text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_phone text;

-- 4. Pickup preparation time (form of: e.g. "15 minutes", "24 hours")
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_preparation_time text;

-- 5. Shipping fields are only populated for shipping orders (nullable now).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_method_code text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_method_name text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS label_url text;

-- 7. Existing orders are all shipping orders: the column default already
--    covers them (NOT NULL DEFAULT 'shipping'), and shipping_method_code /
--    shipping_method_name / tracking_number / label_url were added by
--    migration 20260104 — the ADD COLUMN IF NOT EXISTS above is a no-op for
--    databases that already ran it.

-- 8. RLS: no policy changes. Reads/writes of the new columns go through the
--    same paths as before — customer pages read their own orders via the
--    existing orders_select_own policy, and admin routes use the service
--    role (bypasses RLS) behind requireAdminUser.

-- Indexes for the admin fulfillment filters.
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_method
  ON public.orders (fulfillment_method);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_status
  ON public.orders (pickup_status) WHERE fulfillment_method = 'store_pickup';

GRANT ALL ON public.orders TO service_role;
