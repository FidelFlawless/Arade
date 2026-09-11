import { describe, expect, it } from "vitest";
import {
  calculateDeliveryFee,
  formatPrice,
  isValidNorthAmericanPhone,
  safeInternalRedirect,
} from "@/lib/utils";

describe("Arade utility rules", () => {
  it("accepts formatted Canada and US phone numbers", () => {
    expect(isValidNorthAmericanPhone("+1 (416) 555-0123")).toBe(true);
    expect(isValidNorthAmericanPhone("212-555-0123")).toBe(true);
  });

  it("rejects invalid or non-NANP phone numbers", () => {
    expect(isValidNorthAmericanPhone("12345")).toBe(false);
    expect(isValidNorthAmericanPhone("+44 20 7946 0958")).toBe(false);
    expect(isValidNorthAmericanPhone("+1 (011) 555-0123")).toBe(false);
  });

  it("calculates delivery fees at the configured threshold", () => {
    expect(calculateDeliveryFee(179.99, "CAD")).toBe(9.99);
    expect(calculateDeliveryFee(180, "CAD")).toBe(0);
    expect(calculateDeliveryFee(50, "USD")).toBe(7.99);
  });

  it("formats CAD and USD prices", () => {
    expect(formatPrice(29.99, "CAD")).toBe("CA$29.99");
    expect(formatPrice(29.99, "USD")).toBe("$29.99");
  });

  it("allows only internal login redirects", () => {
    expect(safeInternalRedirect("/checkout")).toBe("/checkout");
    expect(safeInternalRedirect("https://example.com")).toBe("/account");
    expect(safeInternalRedirect("//example.com")).toBe("/account");
  });
});