import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
  if (subtotal >= 180) return 0;
  return currency === "CAD" ? 9.99 : 7.99;
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
