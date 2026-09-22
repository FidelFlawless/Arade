/**
 * One-off smoke test for the order confirmation email.
 * Run: npx tsx tests/order-email.smoke.ts
 *
 * Creates a temporary paid test order, sends the REAL confirmation email
 * through src/lib/emails.ts (same code path as production), then deletes
 * the temporary order and its items.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

// Load .env.local manually BEFORE importing src modules (no dotenv dependency)
const env: Record<string, string> = {};
fs.readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  });
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

// Dynamic imports so env vars exist before emails.ts creates its client
async function loadEmailHelper() {
  const mod = await import("../src/lib/emails");
  return mod.sendOrderConfirmationEmail;
}

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const TEST_USER_ID = "7e21ef56-ebca-46b7-9ed8-98368601aca8"; // fidelflawless@gmail.com

async function main() {
  console.log("1. Creating temporary test order...");
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: TEST_USER_ID,
      order_number: `TEST-${Date.now()}`,
      subtotal: 60,
      delivery_fee: 20,
      discount: 0,
      total: 80,
      currency: "CAD",
      payment_status: "paid",
      order_status: "processing",
      shipping_first_name: "Fidelia",
      shipping_last_name: "Test",
      shipping_phone: "4375662773",
      shipping_address_line1: "123 Test Street",
      shipping_city: "Toronto",
      shipping_state_province: "ON",
      shipping_postal_code: "M5V 2T6",
      shipping_country: "CA",
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    console.error("FAILED to create test order:", orderError?.message);
    process.exit(1);
  }
  console.log("   Created:", order.order_number, order.id);

  // Fetch a real product to make the item row realistic
  const { data: product } = await supabaseAdmin
    .from("products")
    .select("id, name, image_url")
    .eq("is_active", true)
    .limit(1)
    .single();

  console.log("2. Adding order item...");
  const { error: itemError } = await supabaseAdmin.from("order_items").insert({
    order_id: order.id,
    product_id: product?.id ?? TEST_USER_ID,
    product_name: product?.name ?? "Test Product",
    unit_price: 60,
    quantity: 1,
    subtotal: 60,
  });
  if (itemError) console.error("Item insert warning:", itemError.message);

  console.log("3. Sending the real order confirmation email...");
  const sendOrderConfirmationEmail = await loadEmailHelper();
  const sent = await sendOrderConfirmationEmail(order.id);
  console.log("   Result:", sent ? "SENT (Brevo accepted)" : "FAILED (check logs above)");

  console.log("4. Cleaning up temporary order...");
  await supabaseAdmin.from("order_items").delete().eq("order_id", order.id);
  await supabaseAdmin.from("orders").delete().eq("id", order.id);
  console.log("   Deleted:", order.order_number);

  console.log("\nDone. Check fidelflawless@gmail.com for the email");
  console.log("(subject starts with 'Your Arade order TEST-').");
  process.exit(sent ? 0 : 1);
}

main();
