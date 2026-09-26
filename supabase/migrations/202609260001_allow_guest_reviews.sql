-- Allow guest reviews and store reviewer metadata.
-- Safe to re-run.

ALTER TABLE public.reviews
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS reviewer_name text,
  ADD COLUMN IF NOT EXISTS reviewer_email text;

UPDATE public.reviews r
SET reviewer_name = p.full_name
FROM public.profiles p
WHERE r.user_id = p.id
  AND r.reviewer_name IS NULL;

-- Optional: avoid duplicate reviews from the same sessionless reviewer on the same product
-- by auditing guest entries by name/email when user_id is null.
-- Keep indexes small and only add if the table is already in use.
CREATE INDEX IF NOT EXISTS reviews_guest_name_product_idx
  ON public.reviews (product_id, reviewer_name)
  WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS reviews_guest_email_product_idx
  ON public.reviews (product_id, reviewer_email)
  WHERE user_id IS NULL;
