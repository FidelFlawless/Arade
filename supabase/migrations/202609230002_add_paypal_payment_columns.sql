alter table public.payments
  add column if not exists provider text,
  add column if not exists paypal_order_id text;

drop index if exists public.payments_paypal_order_id_unique;

create unique index if not exists payments_paypal_order_id_unique
  on public.payments (paypal_order_id);

create or replace function public.finalize_paypal_payment(
  p_order_id uuid,
  p_paypal_order_id text,
  p_capture_id text,
  p_amount numeric,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row orders%rowtype;
  item_row record;
begin
  select * into order_row
  from orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if order_row.payment_status = 'paid' then
    return;
  end if;

  if order_row.currency <> p_currency or abs(order_row.total - p_amount) > 0.01 then
    raise exception 'PayPal payment does not match order total';
  end if;

  insert into payments (order_id, provider, paypal_order_id, amount, currency, status)
  values (p_order_id, 'paypal', p_paypal_order_id, p_amount, p_currency, 'paid');

  update orders
  set payment_status = 'paid',
      payment_id = p_capture_id,
      order_status = 'processing'
  where id = p_order_id;

  for item_row in
    select product_id, quantity from order_items where order_id = p_order_id
  loop
    perform decrement_stock(item_row.product_id, item_row.quantity);
  end loop;
end;
$$;