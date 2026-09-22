import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aradeshop.com";

// Send abandoned cart email via Brevo transactional
async function sendAbandonedCartEmail(
  email: string,
  firstName: string,
  items: Array<{ name: string; price_cad: number; quantity: number; image: string | null; slug: string }>,
  cartTotal: number,
  currency: string
): Promise<boolean> {
  try {
    const currencySymbol = currency === "CAD" ? "C$" : "US$";

    // Build product rows
    const productRows = items
      .map(
        (item) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ece4;">
            <div style="display: flex; align-items: center; gap: 12px;">
              ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;" />` : ""}
              <div>
                <p style="margin: 0; font-weight: 600; color: #1a1a2e; font-size: 14px;">${item.name}</p>
                <p style="margin: 4px 0 0; color: #666; font-size: 13px;">Qty: ${item.quantity}</p>
              </div>
            </div>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0ece4; text-align: right; font-weight: 600; color: #8B5E3C;">
            ${currencySymbol}${(item.price_cad * item.quantity).toFixed(2)}
          </td>
        </tr>`
      )
      .join("");

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #faf8f5; font-family: 'Helvetica Neue', Arial, sans-serif;">
      <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 24px; color: #1a1a2e; margin: 0 0 8px; font-weight: 700;">Arade</h1>
          <p style="color: #8B5E3C; font-size: 13px; letter-spacing: 2px; margin: 0; text-transform: uppercase;">Beauty · Skincare · Hair · Fashion</p>
        </div>

        <div style="background: white; border-radius: 16px; padding: 32px; margin-bottom: 24px; border: 1px solid #f0ece4;">
          <h2 style="font-size: 20px; color: #1a1a2e; margin: 0 0 8px;">You left something behind, ${firstName || "there"}!</h2>
          <p style="color: #666; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
            Your cart is waiting for you. Complete your order before these items sell out.
          </p>

          <table style="width: 100%; border-collapse: collapse;">
            ${productRows}
          </table>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 2px solid #f0ece4; display: flex; justify-content: space-between;">
            <span style="font-weight: 700; color: #1a1a2e; font-size: 16px;">Total</span>
            <span style="font-weight: 700; color: #8B5E3C; font-size: 16px;">${currencySymbol}${cartTotal.toFixed(2)}</span>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${SITE_URL}/cart" style="display: inline-block; background-color: #8B5E3C; color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Complete Your Order</a>
        </div>

        <p style="text-align: center; color: #999; font-size: 12px;">
          If you don't want to receive these emails, you can ignore this message.
        </p>
      </div>
    </body>
    </html>`;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "Arade", email: "hello@aradeshop.com" },
        to: [{ email }],
        subject: "You left items in your cart",
        htmlContent,
      }),
    });

    return response.ok;
  } catch (err) {
    console.error("Failed to send abandoned cart email:", err);
    return false;
  }
}

// GET - Called by Vercel cron every hour
export async function GET() {
  // No auth check needed - endpoint only sends reminder emails

  try {
    // Find carts abandoned for more than 3 hours, not yet emailed
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data: abandonedCarts, error } = await supabaseAdmin
      .from("abandoned_carts")
      .select("*")
      .eq("email_sent", false)
      .not("email", "is", null)
      .neq("email", "")
      .lt("last_active", threeHoursAgo)
      .limit(50);

    if (error) {
      console.error("Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!abandonedCarts || abandonedCarts.length === 0) {
      return NextResponse.json({ status: "no_abandoned_carts", count: 0 });
    }

    let emailsSent = 0;

    for (const cart of abandonedCarts) {
      // Get the user's first name from profiles
      let firstName = "";
      if (cart.user_id) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", cart.user_id)
          .single();
        if (profile?.full_name) {
          firstName = profile.full_name.split(" ")[0];
        }
      }

      // Postgres NUMERIC columns arrive as strings from Supabase -
      // coerce to number to avoid `.toFixed(2)` runtime crashes
      const cartTotal =
        typeof cart.cart_total === "string"
          ? parseFloat(cart.cart_total) || 0
          : cart.cart_total || 0;

      const sent = await sendAbandonedCartEmail(
        cart.email,
        firstName,
        cart.items || [],
        cartTotal,
        cart.currency || "CAD"
      );

      if (sent) {
        // Mark as sent
        await supabaseAdmin
          .from("abandoned_carts")
          .update({
            email_sent: true,
            email_sent_at: new Date().toISOString(),
          })
          .eq("id", cart.id);

        emailsSent++;
      }
    }

    return NextResponse.json({
      status: "completed",
      total_abandoned: abandonedCarts.length,
      emails_sent: emailsSent,
    });
  } catch (err) {
    console.error("Abandoned cart cron error:", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
