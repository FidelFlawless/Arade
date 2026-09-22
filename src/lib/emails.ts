import { createClient } from "@supabase/supabase-js";

/**
 * Transactional order confirmation email, sent via Brevo after a payment is
 * confirmed server-side (Stripe webhook or PayPal capture - never client-side).
 *
 * The sender must be a verified sender in Brevo (hello@aradeshop.com),
 * otherwise Brevo silently rejects delivery.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.aradeshop.com";
const SENDER = { name: "Arade", email: "hello@aradeshop.com" };

/** Escape user-provided strings before embedding them in HTML. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function currencySymbol(currency: string): string {
  return currency === "USD" ? "US$" : "C$";
}

function money(amount: number | string, currency: string): string {
  const n = typeof amount === "string" ? parseFloat(amount) || 0 : amount || 0;
  return `${currencySymbol(currency)}${n.toFixed(2)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function emailShell(title: string, bodyHtml: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin: 0; padding: 0; background-color: #faf8f5; font-family: 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <img src="${SITE_URL}/logo.webp" alt="Arade" width="72" height="72" style="display: block; margin: 0 auto 12px; border-radius: 16px;" />
        <h1 style="font-size: 24px; color: #1a1a2e; margin: 0 0 8px; font-weight: 700;">Arade</h1>
        <p style="color: #8B5E3C; font-size: 13px; letter-spacing: 2px; margin: 0; text-transform: uppercase;">Beauty &middot; Skincare &middot; Hair &middot; Fashion</p>
      </div>

      <div style="background: white; border-radius: 16px; padding: 32px; margin-bottom: 24px; border: 1px solid #f0ece4;">
        ${bodyHtml}
      </div>

      <p style="text-align: center; color: #999; font-size: 12px;">
        If you have any questions about your order, reply to this email or use the contact page on our website.
      </p>
    </div>
  </body>
  </html>`;
}

interface OrderRow {
  id: string;
  user_id: string;
  order_number: string;
  subtotal: number | string;
  delivery_fee: number | string;
  discount: number | string | null;
  total: number | string;
  currency: string;
  created_at: string;
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_state_province: string;
  shipping_postal_code: string;
  shipping_country: string;
}

interface OrderItemRow {
  product_name: string;
  unit_price: number | string;
  quantity: number;
  subtotal: number | string;
}

/**
 * Send the order confirmation email for a paid order.
 * Fetches the order and its items from the database, builds the branded
 * template and sends it via Brevo. Never throws - returns true on accepted
 * send, false otherwise, so callers can safely fire it without blocking
 * checkout on email failures.
 */
export async function sendOrderConfirmationEmail(orderId: string): Promise<boolean> {
  try {
    if (!BREVO_API_KEY) {
      console.error("Order confirmation email skipped: BREVO_API_KEY not set");
      return false;
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order confirmation email: order not found", orderId, orderError?.message);
      return false;
    }

    const o = order as OrderRow;

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("product_name, unit_price, quantity, subtotal")
      .eq("order_id", orderId);

    if (itemsError || !items || items.length === 0) {
      console.error("Order confirmation email: no items found for order", orderId);
      return false;
    }

    // The orders table has no email column - the recipient is the
    // account email on the user's profile.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", (order as OrderRow).user_id)
      .single();

    const recipient = profile?.email;
    if (!recipient) {
      console.error("Order confirmation email: no account email for user", (order as OrderRow).user_id);
      return false;
    }

    const firstName = esc(o.shipping_first_name || "there");
    const itemRows = (items as OrderItemRow[])
      .map(
        (item) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ece4;">
            <div style="font-weight: 600; color: #1a1a2e; font-size: 14px;">${esc(item.product_name)}</div>
            <div style="color: #666; font-size: 13px; margin-top: 4px;">${money(item.unit_price, o.currency)} &times; ${esc(item.quantity)}</div>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ece4; text-align: right; font-weight: 600; color: #8B5E3C;">
            ${money(item.subtotal, o.currency)}
          </td>
        </tr>`
      )
      .join("");

    const addressHtml = `
      <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.7;">
        ${esc(o.shipping_first_name)} ${esc(o.shipping_last_name)}<br />
        ${esc(o.shipping_address_line1)}${o.shipping_address_line2 ? `<br />${esc(o.shipping_address_line2)}` : ""}<br />
        ${esc(o.shipping_city)}, ${esc(o.shipping_state_province)} ${esc(o.shipping_postal_code)}<br />
        ${o.shipping_country === "CA" ? "Canada" : "United States"}
      </p>`;

    const discountRow =
      o.discount && parseFloat(String(o.discount)) > 0
        ? `<div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #666; font-size: 14px;">Discount</span>
            <span style="color: #666; font-size: 14px;">-${money(o.discount, o.currency)}</span>
          </div>`
        : "";

    const htmlContent = emailShell(
      "Order confirmation",
      `
      <h2 style="font-size: 20px; color: #1a1a2e; margin: 0 0 8px;">Thank you for your order, ${firstName}!</h2>
      <p style="color: #666; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
        Your payment has been confirmed and we're getting your order ready.
      </p>

      <div style="background: #faf8f5; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; display: flex; justify-content: space-between;">
        <div>
          <p style="margin: 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Order number</p>
          <p style="margin: 4px 0 0; font-weight: 700; color: #1a1a2e; font-size: 15px;">${esc(o.order_number)}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Date</p>
          <p style="margin: 4px 0 0; font-weight: 600; color: #1a1a2e; font-size: 14px;">${esc(formatDate(o.created_at))}</p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        ${itemRows}
      </table>

      <div style="margin-top: 20px; padding-top: 16px; border-top: 2px solid #f0ece4;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #666; font-size: 14px;">Subtotal</span>
          <span style="color: #666; font-size: 14px;">${money(o.subtotal, o.currency)}</span>
        </div>
        ${discountRow}
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="color: #666; font-size: 14px;">Delivery</span>
          <span style="color: #666; font-size: 14px;">${money(o.delivery_fee, o.currency)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0ece4;">
          <span style="font-weight: 700; color: #1a1a2e; font-size: 16px;">Total</span>
          <span style="font-weight: 700; color: #8B5E3C; font-size: 16px;">${money(o.total, o.currency)}</span>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <p style="margin: 0 0 8px; font-weight: 700; color: #1a1a2e; font-size: 14px;">Shipping to</p>
        ${addressHtml}
      </div>

      <div style="text-align: center; margin-top: 28px;">
        <a href="${SITE_URL}/order/${esc(o.order_number)}" style="display: inline-block; background-color: #8B5E3C; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">View Order Details</a>
      </div>
      <p style="text-align: center; color: #999; font-size: 12px; margin-top: 12px;">
        You can also track this order anytime from your account.
      </p>`
    );

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: recipient }],
        subject: `Your Arade order ${o.order_number} - view your order details`,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Order confirmation email failed:", response.status, errText.slice(0, 300));
      return false;
    }

    return true;
  } catch (err) {
    console.error("Order confirmation email error:", err);
    return false;
  }
}
