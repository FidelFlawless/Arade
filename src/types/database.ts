// Database types matching Supabase schema
// Generated manually to match the existing tables

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      categories: {
        Row: Category;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
      };
      products: {
        Row: Product;
        Insert: ProductInsert;
        Update: ProductUpdate;
      };
      addresses: {
        Row: Address;
        Insert: AddressInsert;
        Update: AddressUpdate;
      };
      cart_items: {
        Row: CartItem;
        Insert: CartItemInsert;
        Update: CartItemUpdate;
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: OrderUpdate;
      };
      order_items: {
        Row: OrderItem;
        Insert: OrderItemInsert;
        Update: OrderItemUpdate;
      };
      payments: {
        Row: Payment;
        Insert: PaymentInsert;
        Update: PaymentUpdate;
      };
      reviews: {
        Row: Review;
        Insert: ReviewInsert;
        Update: ReviewUpdate;
      };
      newsletter_subscribers: {
        Row: NewsletterSubscriber;
        Insert: NewsletterSubscriberInsert;
        Update: NewsletterSubscriberUpdate;
      };
    };
  };
}

// ---- Profiles ----
export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileInsert {
  id: string;
  email?: string | null;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
  phone?: string | null;
  country?: string | null;
  role?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileUpdate {
  email?: string | null;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
  phone?: string | null;
  country?: string | null;
  role?: string;
  updated_at?: string;
}

// ---- Categories ----
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryInsert {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryUpdate {
  name?: string;
  slug?: string;
  description?: string | null;
  image_url?: string | null;
  updated_at?: string;
}

// ---- Products ----
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_cad: number;
  price_usd: number;
  category_id: string;
  images: string[];
  stock_quantity: number;
  ingredients: string | null;
  benefits: string | null;
  how_to_use: string | null;
  skin_types: string[];
  size: string | null;
  is_active: boolean;
  is_featured: boolean;
  average_rating: number;
  review_count: number;
  sales_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProductInsert {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price_cad: number;
  price_usd: number;
  category_id: string;
  images?: string[];
  stock_quantity?: number;
  ingredients?: string | null;
  benefits?: string | null;
  how_to_use?: string | null;
  skin_types?: string[];
  size?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  average_rating?: number;
  review_count?: number;
  sales_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductUpdate {
  name?: string;
  slug?: string;
  description?: string;
  price_cad?: number;
  price_usd?: number;
  category_id?: string;
  images?: string[];
  stock_quantity?: number;
  ingredients?: string | null;
  benefits?: string | null;
  how_to_use?: string | null;
  skin_types?: string[];
  size?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  average_rating?: number;
  review_count?: number;
  sales_count?: number;
  updated_at?: string;
}

// ---- Addresses ----
export interface Address {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  province_state: string;
  postal_code: string;
  country: "CA" | "US";
  phone: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressInsert {
  id?: string;
  user_id: string;
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  province_state: string;
  postal_code: string;
  country: "CA" | "US";
  phone?: string | null;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AddressUpdate {
  first_name?: string;
  last_name?: string;
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  province_state?: string;
  postal_code?: string;
  country?: "CA" | "US";
  phone?: string | null;
  is_default?: boolean;
  updated_at?: string;
}

// ---- Cart Items ----
export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface CartItemInsert {
  id?: string;
  user_id: string;
  product_id: string;
  quantity?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CartItemUpdate {
  quantity?: number;
  updated_at?: string;
}

// ---- Orders ----
export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  currency: "CAD" | "USD";
  payment_status: "pending" | "paid" | "failed" | "refunded";
  stripe_session_id: string | null;
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_email: string;
  shipping_phone: string | null;
  shipping_address_line1: string;
  shipping_address_line2: string | null;
  shipping_city: string;
  shipping_province_state: string;
  shipping_postal_code: string;
  shipping_country: "CA" | "US";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderInsert {
  id?: string;
  user_id: string;
  order_number: string;
  status?: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  delivery_fee: number;
  discount?: number;
  total: number;
  currency: "CAD" | "USD";
  payment_status?: "pending" | "paid" | "failed" | "refunded";
  stripe_session_id?: string | null;
  shipping_first_name: string;
  shipping_last_name: string;
  shipping_email: string;
  shipping_phone?: string | null;
  shipping_address_line1: string;
  shipping_address_line2?: string | null;
  shipping_city: string;
  shipping_province_state: string;
  shipping_postal_code: string;
  shipping_country: "CA" | "US";
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OrderUpdate {
  status?: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  payment_status?: "pending" | "paid" | "failed" | "refunded";
  stripe_session_id?: string | null;
  notes?: string | null;
  updated_at?: string;
}

// ---- Order Items ----
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  price_cad: number;
  price_usd: number;
  total: number;
  created_at: string;
}

export interface OrderItemInsert {
  id?: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_image?: string | null;
  quantity: number;
  price_cad: number;
  price_usd: number;
  total: number;
  created_at?: string;
}

export interface OrderItemUpdate {
  quantity?: number;
  total?: number;
}

// ---- Payments ----
export interface Payment {
  id: string;
  order_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  amount: number;
  currency: "CAD" | "USD";
  status: "pending" | "succeeded" | "failed" | "refunded";
  payment_method: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentInsert {
  id?: string;
  order_id: string;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  amount: number;
  currency: "CAD" | "USD";
  status?: "pending" | "succeeded" | "failed" | "refunded";
  payment_method?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentUpdate {
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  status?: "pending" | "succeeded" | "failed" | "refunded";
  payment_method?: string | null;
  updated_at?: string;
}

// ---- Reviews ----
export interface Review {
  id: string;
  user_id: string;
  product_id: string;
  order_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewInsert {
  id?: string;
  user_id: string;
  product_id: string;
  order_id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  is_verified?: boolean;
  is_approved?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ReviewUpdate {
  rating?: number;
  title?: string | null;
  comment?: string | null;
  is_approved?: boolean;
  updated_at?: string;
}

// ---- Newsletter Subscribers ----
export interface NewsletterSubscriber {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewsletterSubscriberInsert {
  id?: string;
  email: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NewsletterSubscriberUpdate {
  is_active?: boolean;
  updated_at?: string;
}

// Helper types for joined queries
export interface ProductWithCategory extends Product {
  categories: Category;
}

export interface CartItemWithProduct extends CartItem {
  products: Product;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface ReviewWithUser extends Review {
  profiles: Pick<Profile, "full_name" | "avatar_url">;
}
