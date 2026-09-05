// Site information
export const SITE_NAME = "Arade";
export const SITE_DESCRIPTION =
  "Professional skincare products for radiant, healthy skin. Shop cleansers, moisturizers, serums, and more.";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Delivery settings
export const FREE_DELIVERY_THRESHOLD = 180; // Orders $180+ get free delivery
export const DELIVERY_FEE_CAD = 9.99;
export const DELIVERY_FEE_USD = 7.99;

// Supported countries
export const SUPPORTED_COUNTRIES = [
  { code: "CA", name: "Canada", currency: "CAD" as const },
  { code: "US", name: "United States", currency: "USD" as const },
] as const;

export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number]["code"];
export type Currency = "CAD" | "USD";

// Canadian provinces and territories
export const CANADIAN_PROVINCES = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

// US states
export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

// Product categories
export const PRODUCT_CATEGORIES = [
  { slug: "cleansers", name: "Cleansers" },
  { slug: "moisturizers", name: "Moisturizers" },
  { slug: "serums", name: "Serums" },
  { slug: "sunscreen", name: "Sunscreen" },
  { slug: "toners", name: "Toners" },
  { slug: "masks", name: "Masks" },
  { slug: "body-care", name: "Body Care" },
  { slug: "skincare-sets", name: "Skincare Sets" },
];

// Order statuses
export const ORDER_STATUSES = [
  { value: "pending", label: "Pending", color: "text-yellow-600 bg-yellow-50" },
  {
    value: "processing",
    label: "Processing",
    color: "text-blue-600 bg-blue-50",
  },
  {
    value: "shipped",
    label: "Shipped",
    color: "text-purple-600 bg-purple-50",
  },
  {
    value: "delivered",
    label: "Delivered",
    color: "text-green-600 bg-green-50",
  },
  { value: "cancelled", label: "Cancelled", color: "text-red-600 bg-red-50" },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

// Payment statuses
export const PAYMENT_STATUSES = [
  { value: "pending", label: "Pending", color: "text-yellow-600 bg-yellow-50" },
  { value: "paid", label: "Paid", color: "text-green-600 bg-green-50" },
  {
    value: "failed",
    label: "Failed",
    color: "text-red-600 bg-red-50",
  },
  {
    value: "refunded",
    label: "Refunded",
    color: "text-gray-600 bg-gray-50",
  },
] as const;

// Skin types for product filtering
export const SKIN_TYPES = [
  "Normal",
  "Dry",
  "Oily",
  "Combination",
  "Sensitive",
];

// Sort options for shop page
export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "best-selling", label: "Best Selling" },
];

// Items per page for pagination
export const PRODUCTS_PER_PAGE = 12;

// Navigation links
export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/collection", label: "Collection" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];
