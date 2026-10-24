-- Flat-rate delivery (2026-10-24)
--
-- Delivery is no longer priced from live Canada Post rates at checkout:
--   * orders at or above the threshold ship free (C$200 / US$200)
--   * orders below it are charged the flat fee (C$40 / US$40)
--
-- Both numbers live in store_settings and are editable in Admin -> Settings.
-- This migration only rewrites the LEGACY defaults (180 / 20 / 14.29) so a
-- value an admin already customised is left untouched. If a key is missing,
-- the app falls back to 200 / 40 / 40, so no insert is required here.
--
-- Idempotent: safe to run more than once.

UPDATE public.store_settings
   SET value = '200'
 WHERE key = 'free_delivery_threshold'
   AND value = '180';

UPDATE public.store_settings
   SET value = '40'
 WHERE key = 'delivery_fee_cad'
   AND value = '20';

UPDATE public.store_settings
   SET value = '40'
 WHERE key = 'delivery_fee_usd'
   AND value = '14.29';
