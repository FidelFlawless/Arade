-- Welcome email send-once flag.
-- The welcome/coupon email is sent server-side when the user verifies their
-- email (auth callback). This timestamp guarantees it is sent at most once
-- per user even if the verification link is clicked multiple times.
alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;
