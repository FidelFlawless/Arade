import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { FREE_DELIVERY_THRESHOLD, DELIVERY_FEE_CAD, DELIVERY_FEE_USD } from "@/lib/constants";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, items, shippingAddress, country } = body;

    // 1. Verify user is authenticated
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the user ID matches the session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
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

    // 3. Fetch actual prices from database (NEVER trust browser prices)
    const productIds = items.map((item: { productId: string }) => item.productId);
    const { data: dbProducts, error: dbError } = await supabaseAdmin
      .from("products")
      .select("id, name, price_cad, price_usd, stock_quantity, is_active, category_id")
      .in("id", productIds)
      .eq("is_active", true);

    if (dbError || !dbProducts) {
      return NextResponse.json({ error: "Failed to verify products" }, { status: 500 });
    }

    // 4. Build validated items with server-side prices
    const validatedItems = [];
    let subtotal = 0;
    const currency = country === "CA" ? "CAD" : "USD";

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

      // Use SERVER price, not browser price
      const serverPrice = currency === "CAD" ? dbProduct.price_cad : dbProduct.price_usd;
      const itemTotal = serverPrice * item.quantity;
      subtotal += itemTotal;

      validatedItems.push({
        product_id: dbProduct.id,
        product_name: dbProduct.name,
        quantity: item.quantity,
        unit_price: serverPrice,
        total_price: itemTotal,
        currency,
      });
    }

    // 5. Calculate delivery fee SERVER-SIDE
    const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD
      ? 0
      : currency === "CAD"
        ? DELIVERY_FEE_CAD
        : DELIVERY_FEE_USD;

    const total = subtotal + deliveryFee;

    // 6. Create order
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

    // 7. Create order items
    const orderItems = validatedItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      currency,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      return NextResponse.json({ error: "Failed to create order items" }, { status: 500 });
    }

    // 8. Update stock quantities
    for (const item of validatedItems) {
      await supabaseAdmin.rpc("decrement_stock" as never, {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      } as never);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      total,
      currency,
      subtotal,
      deliveryFee,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
