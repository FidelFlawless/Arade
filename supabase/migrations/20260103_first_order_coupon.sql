-- ============================================================
-- First-order discount (20% off first purchase after signup)
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
-- ============================================================

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS first_order_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS expires_days_after_signup integer
  CHECK (expires_days_after_signup IS NULL OR expires_days_after_signup > 0);
