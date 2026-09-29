import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  CANADIAN_PROVINCES,
  DELIVERY_FEE_CAD,
  DELIVERY_FEE_USD,
  FREE_DELIVERY_THRESHOLD,
  US_STATES,
} from "@/lib/constants";

// Merge Tailwind classes safely
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format price with currency symbol
export function formatPrice(
  amount: number,
  currency: "CAD" | "USD" = "CAD"
): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}

// Format date nicely
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

// Format date with time
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

// Generate URL-friendly slug from text
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Truncate text to a given length
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + "...";
}

// Calculate delivery fee
export function calculateDeliveryFee(
  subtotal: number,
  currency: "CAD" | "USD" = "CAD"
): number {
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  return currency === "CAD" ? DELIVERY_FEE_CAD : DELIVERY_FEE_USD;
}

// Get the appropriate currency symbol
export function getCurrencySymbol(currency: "CAD" | "USD"): string {
  return currency === "CAD" ? "C$" : "US$";
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate Canadian postal code
export function isValidCanadianPostalCode(code: string): boolean {
  const regex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
  return regex.test(code);
}

// Validate US ZIP code
export function isValidUSZipCode(code: string): boolean {
  const regex = /^\d{5}(-\d{4})?$/;
  return regex.test(code);
}

export function isValidShippingPostalCode(country: "CA" | "US", code: string): boolean {
  return country === "CA" ? isValidCanadianPostalCode(code.trim()) : isValidUSZipCode(code.trim());
}

// First letter of a Canadian postal code maps to a province/territory (FSA
// mapping). Used to catch mismatched province + postal code combinations
// (e.g. "Newcastle, NT M5V 2T6") before they reach Canada Post.
const POSTAL_FSA_PROVINCES: Record<string, string[]> = {
  A: ["NL"],
  B: ["NS", "PE"],
  C: ["PE"],
  E: ["NB"],
  G: ["QC"],
  H: ["QC"],
  J: ["QC"],
  K: ["ON"],
  L: ["ON"],
  M: ["ON"],
  N: ["ON"],
  P: ["ON"],
  R: ["MB"],
  S: ["SK"],
  T: ["AB"],
  V: ["BC"],
  X: ["NT", "NU"],
  Y: ["YT"],
};

/**
 * Returns an error message if a Canadian province and postal code don't
 * match (the postal code's first letter must be valid for the province).
 * Returns null when consistent or when not applicable (US addresses).
 */
export function provincePostalMismatch(
  country: "CA" | "US",
  province: string,
  postalCode: string
): string | null {
  if (country !== "CA") return null;
  const code = postalCode.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(code)) return null; // format validated separately
  const allowed = POSTAL_FSA_PROVINCES[code[0]];
  if (!allowed || !province) return null;
  if (!allowed.includes(province)) {
    return "The postal code does not match the selected province. Please check both fields.";
  }
  return null;
}

export function isValidShippingRegion(country: "CA" | "US", region: string): boolean {
  const regions = country === "CA" ? CANADIAN_PROVINCES : US_STATES;
  return regions.some(({ code }) => code === region);
}

// Canada and the United States use the North American Numbering Plan.
export function isValidNorthAmericanPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  const nationalNumber = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;

  return nationalNumber.length === 10
    && !nationalNumber.startsWith("0")
    && !nationalNumber.startsWith("1")
    && nationalNumber.slice(3, 4) !== "0"
    && nationalNumber.slice(3, 4) !== "1";
}

export function safeInternalRedirect(value: string | null | undefined, fallback = "/account"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
