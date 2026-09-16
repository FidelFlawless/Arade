import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidNorthAmericanPhone } from "@/lib/utils";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET!;
const PAYPAL_ENV = process.env.PAYPAL_ENVIRONMENT || "sandbox";

const PAYPAL_BASE =
  PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");

  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, items, shippingAddress, country, currency } = body;

    // 1. Verify user exists
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Validate inputs
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    if (!shippingAddress || !country) {
      return NextResponse.json({ error: "Shipping address required" }, { status: 400 });
    }

    if (country !== "CA" && country !== "US") {
      return NextResponse.json({ error: "Only Canada and USA are supported" }, { status: 400 });
    }

    if (!shippingAddress.phone || !isValidNorthAmericanPhone(shippingAddress.phone)) {
      return NextResponse.json(
        { error: "A valid Canada or United States phone number is required" },
        { status: 400 }
      );
    }

    // 3. Fetch actual prices from database (NEVER trust browser prices)
    const productIds = items.map((item: { productId: string }) => item.productId);
    const { data: dbProducts, error: dbError } = await supabaseAdmin
      .from("products")
      .select("id, name, price_cad, price_usd, stock_quantity, is_active, image_url")
      .in("id", productIds)
      .eq("is_active", true);

    if (dbError || !dbProducts) {
      return NextResponse.json({ error: "Failed to verify products" }, { status: 500 });
    }

    // 4. Build validated items with server-side prices
    const validatedItems: Array<{
      productId: string;
      name: string;
      quantity: number;
      serverPrice: number;
      image: string | null;
    }> = [];

    let subtotal = 0;

    for (const item of items) {
      const dbProduct = dbProducts.find((p) => p.id === item.productId);

      if (!dbProduct) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found or unavailable` },
          { status: 400 }
        );
      }

      if (dbProduct.stock_quantity < item.quantity) {
        return NextResponse.json(
          { error: `${dbProduct.name} only has ${dbProduct.stock_quantity} in stock` },
          { status: 400 }
        );
      }

      const serverPrice = currency === "CAD" ? dbProduct.price_cad : dbProduct.price_usd;
      subtotal += serverPrice * item.quantity;

      validatedItems.push({
        productId: dbProduct.id,
        name: dbProduct.name,
        quantity: item.quantity,
        serverPrice,
        image: dbProduct.image_url,
      });
    }

    // 5. Calculate delivery fee SERVER-SIDE
    const deliveryThreshold = 180;
    const deliveryFeeCAD = 9.99;
    const deliveryFeeUSD = 7.99;

    const deliveryFee =
      subtotal >= deliveryThreshold
        ? 0
        : currency === "CAD"
          ? deliveryFeeCAD
          : deliveryFeeUSD;

    const total = subtotal + deliveryFee;

    // 6. Create a pending order in our database
    const orderNumber = `ARD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        order_number: orderNumber,
        subtotal,
        delivery_fee: deliveryFee,
        discount: 0,
        total,
        currency,
        payment_status: "pending",
        order_status: "pending",
        shipping_first_name: shippingAddress.first_name,
        shipping_last_name: shippingAddress.last_name,
        shipping_phone: shippingAddress.phone || null,
        shipping_country: country,
        shipping_address_line1: shippingAddress.address_line1,
        shipping_address_line2: shippingAddress.address_line2 || null,
        shipping_city: shippingAddress.city,
        shipping_state_province: shippingAddress.province_state,
        shipping_postal_code: shippingAddress.postal_code,
        country: country,
        shipping_address: {
          first_name: shippingAddress.first_name,
          last_name: shippingAddress.last_name,
          email: shippingAddress.email,
          phone: shippingAddress.phone,
          address_line1: shippingAddress.address_line1,
          address_line2: shippingAddress.address_line2,
          city: shippingAddress.city,
          province_state: shippingAddress.province_state,
          postal_code: shippingAddress.postal_code,
          country: country,
        },
      })
      .select("id, order_number")
      .single();

    if (orderError) {
      return NextResponse.json({ error: "Failed to create order", details: orderError.message }, { status: 500 });
    }

    // 7. Create order items
    const orderItems = validatedItems.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.serverPrice,
      subtotal: item.serverPrice * item.quantity,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      return NextResponse.json({ error: "Failed to create order items", details: itemsError.message }, { status: 500 });
    }

    // 8. Create PayPal order server-side
    const accessToken = await getPayPalAccessToken();

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aradeshop.com";

    const paypalBody = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: order.order_number,
          description: `Arade Order ${order.order_number}`.substring(0, 127),
          amount: {
            currency_code: currency,
            value: total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: currency,
                value: subtotal.toFixed(2),
              },
              shipping: {
                currency_code: currency,
                value: deliveryFee.toFixed(2),
              },
            },
          },
          items: validatedItems.map((item) => ({
            name: item.name.substring(0, 127),
            unit_amount: {
              currency_code: currency,
              value: item.serverPrice.toFixed(2),
            },
            quantity: item.quantity.toString(),
            category: "PHYSICAL_GOODS",
          })),
          shipping: {
            name: {
              full_name: `${shippingAddress.first_name} ${shippingAddress.last_name}`.substring(0, 300),
            },
            address: {
              address_line_1: shippingAddress.address_line1.substring(0, 300),
              ...(shippingAddress.address_line2
                ? { address_line_2: shippingAddress.address_line2.substring(0, 300) }
                : {}),
              admin_area_2: shippingAddress.city.substring(0, 120),
              admin_area_1: shippingAddress.province_state.substring(0, 300),
              postal_code: shippingAddress.postal_code.substring(0, 10),
              country_code: country,
            },
          },
        },
      ],
      application_context: {
        brand_name: "Arade",
        locale: "en-US",
        landing_page: "BILLING",
        shipping_preference: "SET_PROVIDED_ADDRESS",
        user_action: "PAY_NOW",
        return_url: `${baseUrl}/order/success?paypal_order_id=REPLACE`,
        cancel_url: `${baseUrl}/checkout?cancelled=true`,
      },
    };

    const paypalResponse = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(paypalBody),
    });

    if (!paypalResponse.ok) {
      const errorData = await paypalResponse.json().catch(() => ({}));
      console.error("PayPal create order error (status:", paypalResponse.status, "):", JSON.stringify(errorData, null, 2));

      // Clean up the pending order since PayPal creation failed
      await supabaseAdmin.from("orders").delete().eq("id", order.id);

      // Extract detailed error message
      const details = errorData?.message || errorData?.name || "Unknown PayPal error";
      const debugId = errorData?.debug_id || "";
      return NextResponse.json(
        { error: "Failed to create PayPal order", details: `${details}${debugId ? " (debug: " + debugId + ")" : ""}` },
        { status: 500 }
      );
    }

    const paypalOrder = await paypalResponse.json();

    // 9. Store PayPal order ID on the Arade order
    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: `paypal:${paypalOrder.id}` })
      .eq("id", order.id);

    // Update return_url with actual PayPal order ID
    const finalReturnUrl = `${baseUrl}/order/success?paypal_order_id=${paypalOrder.id}`;

    return NextResponse.json({
      success: true,
      paypalOrderId: paypalOrder.id,
      orderId: order.id,
      orderNumber: order.order_number,
      returnUrl: finalReturnUrl,
    });
  } catch (error: unknown) {
    console.error("PayPal checkout error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
