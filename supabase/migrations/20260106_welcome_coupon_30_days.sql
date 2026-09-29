-- Welcome coupon 30-day validity.
-- The welcome email promises the code is "valid for 30 days"; this makes the
-- promise real. expires_days_after_signup is enforced server-side in
-- validateCoupon: the window runs from welcome_email_sent_at (when the code
-- email was delivered) and falls back to account creation when the flag is
-- missing. Applies to every active first-order coupon.
UPDATE public.coupons
SET expires_days_after_signup = 30
WHERE first_order_only = TRUE
  AND active = TRUE
  AND (expires_days_after_signup IS NULL OR expires_days_after_signup > 30);
