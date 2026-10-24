import {
  DELIVERY_FEE_CAD,
  DELIVERY_FEE_USD,
  FREE_DELIVERY_THRESHOLD,
  type Currency,
} from "@/lib/constants";

/**
 * Flat-rate delivery settings.
 *
 * Arade no longer prices delivery with live Canada Post rates at checkout:
 * orders at or above `freeDeliveryThreshold` ship free, everything below is
 * charged the flat fee for the order currency. All three numbers are editable
 * in Admin -> Settings (stored in `store_settings`); the constants below are
 * only the fallback when a value is missing or invalid.
 */
export type ShippingSettings = {
  freeDeliveryThreshold: number;
  deliveryFeeCad: number;
  deliveryFeeUsd: number;
};

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
  deliveryFeeCad: DELIVERY_FEE_CAD,
  deliveryFeeUsd: DELIVERY_FEE_USD,
};

export const STANDARD_SHIPPING_CODE = "standard";
export const STANDARD_SHIPPING_NAME = "Standard Delivery";
export const FREE_SHIPPING_NAME = "Free Standard Delivery";

function nonNegativeNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Turn a raw `store_settings` map (`{ free_delivery_threshold: "200", ... }`)
 * into the numbers delivery pricing uses. Missing/invalid values fall back to
 * the defaults so checkout never charges a NaN.
 */
export function resolveShippingSettings(
  raw: Record<string, unknown> | null | undefined
): ShippingSettings {
  return {
    freeDeliveryThreshold: nonNegativeNumber(
      raw?.free_delivery_threshold,
      DEFAULT_SHIPPING_SETTINGS.freeDeliveryThreshold
    ),
    deliveryFeeCad: nonNegativeNumber(
      raw?.delivery_fee_cad,
      DEFAULT_SHIPPING_SETTINGS.deliveryFeeCad
    ),
    deliveryFeeUsd: nonNegativeNumber(
      raw?.delivery_fee_usd,
      DEFAULT_SHIPPING_SETTINGS.deliveryFeeUsd
    ),
  };
}

/** Flat delivery fee for a product subtotal, in the order currency. */
export function deliveryFeeFor(
  subtotal: number,
  currency: Currency,
  settings: ShippingSettings = DEFAULT_SHIPPING_SETTINGS
): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  if (subtotal >= settings.freeDeliveryThreshold) return 0;
  return roundCurrency(currency === "CAD" ? settings.deliveryFeeCad : settings.deliveryFeeUsd);
}

/** How much more the customer has to spend to unlock free delivery (0 when free). */
export function freeDeliveryRemaining(
  subtotal: number,
  settings: ShippingSettings = DEFAULT_SHIPPING_SETTINGS
): number {
  const remaining = settings.freeDeliveryThreshold - subtotal;
  return remaining > 0 ? roundCurrency(remaining) : 0;
}

/** Display name of the single flat-rate shipping option. */
export function shippingOptionName(deliveryFee: number): string {
  return deliveryFee === 0 ? FREE_SHIPPING_NAME : STANDARD_SHIPPING_NAME;
}
