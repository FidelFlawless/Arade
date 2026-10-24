import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_SHIPPING_SETTINGS,
  resolveShippingSettings,
  type ShippingSettings,
} from "@/lib/shipping";

/** Only these keys matter for delivery pricing. */
const SHIPPING_SETTING_KEYS = [
  "free_delivery_threshold",
  "delivery_fee_cad",
  "delivery_fee_usd",
] as const;

/**
 * Server-side delivery settings from `store_settings` (Admin -> Settings).
 * Never throws: a database hiccup falls back to the shipped defaults rather
 * than blocking checkout.
 */
export async function getShippingSettings(): Promise<ShippingSettings> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select("key, value")
      .in("key", SHIPPING_SETTING_KEYS);

    if (error || !data) return DEFAULT_SHIPPING_SETTINGS;

    const raw: Record<string, unknown> = {};
    for (const row of data) raw[row.key] = row.value;
    return resolveShippingSettings(raw);
  } catch {
    return DEFAULT_SHIPPING_SETTINGS;
  }
}
