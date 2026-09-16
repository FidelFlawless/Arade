import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side purchase verification for review submission.
 *
 * Ownership is enforced in the database queries themselves - the user id and
 * the order id are never taken from the request body - so a verified-purchase
 * badge can only be granted for a paid order that genuinely belongs to the
 * authenticated user and contains the reviewed product.
 */

/**
 * True when PostgREST/Postgres rejected the query because a column is missing
 * (PGRST204 / 42703). Some databases predate supabase-fix-reviews-columns.sql.
 */
export function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined
) {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

export interface VerifiedPurchase {
  orderId: string;
}

type DbError = { code?: string | null; message?: string | null } | null;

/**
 * Returns the paid order through which `userId` bought `productId`, or null.
 *
 * Payment rule matches the rest of the store: the order must belong to the user
 * and have `payment_status = 'paid'`.
 */
export async function findVerifiedPurchase(
  admin: SupabaseClient,
  userId: string,
  productId: string,
  orderId?: string | null
): Promise<VerifiedPurchase | null> {
  // Preferred path: single query using the order_items -> orders relation.
  let embedQuery = admin
    .from("order_items")
    .select("order_id, orders!inner(id, user_id, payment_status)")
    .eq("product_id", productId)
    .eq("orders.user_id", userId)
    .eq("orders.payment_status", "paid");

  if (orderId) embedQuery = embedQuery.eq("order_id", orderId);

  const { data: embedded, error: embedError } = await embedQuery.limit(1).maybeSingle();

  if (!embedError) {
    return embedded?.order_id ? { orderId: embedded.order_id as string } : null;
  }

  // Fallback for databases without the order_items -> orders FK constraint:
  // resolve the user's paid orders first, then look for the product in them.
  let ordersQuery = admin
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .eq("payment_status", "paid");

  if (orderId) ordersQuery = ordersQuery.eq("id", orderId);

  const { data: orders, error: ordersError }: { data: { id: string }[] | null; error: DbError } =
    await ordersQuery.order("created_at", { ascending: false }).limit(500);

  if (ordersError || !orders?.length) return null;

  const orderIds = orders.map((order) => order.id);
  const { data: items, error: itemsError }: { data: { order_id: string }[] | null; error: DbError } =
    await admin
      .from("order_items")
      .select("order_id")
      .eq("product_id", productId)
      .in("order_id", orderIds)
      .limit(1);

  if (itemsError || !items?.length) return null;
  return { orderId: items[0].order_id };
}
