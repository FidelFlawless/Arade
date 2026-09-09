import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, items, shippingAddress, country, currency } = body;

    // 1. Verify user is authenticated via cookies or auth header
    const authHeader = req.headers.get("authorization");

    let authenticatedUserId = userId;

    if (authHeader) {
      // Try verifying via access token
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || user.id !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      // Fallback: verify user exists in database
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();
      if (!profile) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
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

    const deliveryFee = subtotal >= deliveryThreshold
      ? 0
      : currency === "CAD"
        ? deliveryFeeCAD
        : deliveryFeeUSD;

    const total = subtotal + deliveryFee;

    // 6. Build Stripe line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedItems.map(
      (item) => ({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: item.name,
            ...(item.image ? { images: [item.image] } : {}),
          },
          unit_amount: Math.round(item.serverPrice * 100), // Stripe uses cents
        },
        quantity: item.quantity,
      })
    );

    // Add delivery fee as a line item if > 0
    if (deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: "Delivery",
          },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      });
    }

    // 7. Create a pending order in our database before Stripe checkout
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
        shipping_address: shippingAddress,
        country,
      })
      .select("id, order_number")
      .single();

    if (orderError) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    // 8. Create order items
    const orderItems = validatedItems.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.serverPrice,
      total_price: item.serverPrice * item.quantity,
      currency,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      return NextResponse.json({ error: "Failed to create order items" }, { status: 500 });
    }

    // 9. Create Stripe Checkout Session
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://arade3.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: lineItems,
      shipping_address_collection: {
        allowed_countries: ["CA", "US"],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: currency.toLowerCase() },
            display_name: deliveryFee === 0 ? "Free Delivery" : "Standard Delivery",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        },
      ],
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
        user_id: userId,
      },
      success_url: `${baseUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout?cancelled=true`,
    });

    // 10. Update order with Stripe session ID
    await supabaseAdmin
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    console.error("Stripe checkout error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
