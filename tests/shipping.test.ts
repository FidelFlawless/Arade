import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHIPPING_SETTINGS,
  FREE_SHIPPING_NAME,
  STANDARD_SHIPPING_NAME,
  deliveryFeeFor,
  freeDeliveryRemaining,
  resolveShippingSettings,
  shippingOptionName,
} from "@/lib/shipping";

describe("flat-rate delivery", () => {
  it("ships free at the default $200 threshold in both currencies", () => {
    expect(DEFAULT_SHIPPING_SETTINGS.freeDeliveryThreshold).toBe(200);
    expect(deliveryFeeFor(200, "CAD")).toBe(0);
    expect(deliveryFeeFor(250, "USD")).toBe(0);
  });

  it("charges the flat $40 fee below the threshold", () => {
    expect(deliveryFeeFor(199.99, "CAD")).toBe(40);
    expect(deliveryFeeFor(199.99, "USD")).toBe(40);
    expect(deliveryFeeFor(50, "CAD")).toBe(40);
  });

  it("treats an empty subtotal as no delivery charge", () => {
    expect(deliveryFeeFor(0, "CAD")).toBe(0);
  });

  it("uses the admin-configured threshold and per-currency fees", () => {
    const settings = {
      freeDeliveryThreshold: 300,
      deliveryFeeCad: 25,
      deliveryFeeUsd: 18.5,
    };
    expect(deliveryFeeFor(299, "CAD", settings)).toBe(25);
    expect(deliveryFeeFor(300, "CAD", settings)).toBe(0);
    expect(deliveryFeeFor(100, "USD", settings)).toBe(18.5);
  });

  it("supports a zero fee (always free delivery)", () => {
    const settings = {
      freeDeliveryThreshold: 500,
      deliveryFeeCad: 0,
      deliveryFeeUsd: 0,
    };
    expect(deliveryFeeFor(10, "CAD", settings)).toBe(0);
  });

  it("reports how much more is needed for free delivery", () => {
    expect(freeDeliveryRemaining(150)).toBe(50);
    expect(freeDeliveryRemaining(200)).toBe(0);
    expect(freeDeliveryRemaining(260)).toBe(0);
  });

  it("parses store settings strings and falls back on invalid values", () => {
    expect(
      resolveShippingSettings({
        free_delivery_threshold: "250",
        delivery_fee_cad: "35.5",
        delivery_fee_usd: "27",
      })
    ).toEqual({
      freeDeliveryThreshold: 250,
      deliveryFeeCad: 35.5,
      deliveryFeeUsd: 27,
    });

    expect(
      resolveShippingSettings({
        free_delivery_threshold: "not-a-number",
        delivery_fee_cad: "-5",
        delivery_fee_usd: null,
      })
    ).toEqual(DEFAULT_SHIPPING_SETTINGS);

    expect(resolveShippingSettings(null)).toEqual(DEFAULT_SHIPPING_SETTINGS);
  });

  it("names the single shipping option by whether it is free", () => {
    expect(shippingOptionName(0)).toBe(FREE_SHIPPING_NAME);
    expect(shippingOptionName(40)).toBe(STANDARD_SHIPPING_NAME);
  });
});
