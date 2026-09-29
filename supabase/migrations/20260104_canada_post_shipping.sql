-- Canada Post integration (Phase 1: live rates + shipping method on orders)
-- Run in Supabase SQL Editor BEFORE deploying the code.

-- Package weight per product (grams). Used by the Canada Post Rating API.
alter table public.products
  add column if not exists weight_grams integer not null default 250;

-- Which Canada Post service the customer chose at checkout.
alter table public.orders
  add column if not exists shipping_method_code text;
alter table public.orders
  add column if not exists shipping_method_name text;
-- Tracking PIN once the shipment is created (Phase 2/3).
alter table public.orders
  add column if not exists tracking_number text;
-- Canada Post label link (provided endpoint) for re-downloading the PDF.
alter table public.orders
  add column if not exists label_url text;

grant all on public.products to service_role;
