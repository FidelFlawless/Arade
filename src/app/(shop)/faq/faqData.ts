// Single source of truth for FAQ content. Used by the visible FAQ accordion
// (FaqContent.tsx) and by the FAQPage JSON-LD in page.tsx — they must stay
// identical. Only real questions/answers shown on /faq belong here.
export interface FaqEntry {
  q: string;
  a: string;
}

export interface FaqCategory {
  title: string;
  questions: FaqEntry[];
}

export const faqCategories: FaqCategory[] = [
  {
    title: "Orders & Payment",
    questions: [
      {
        q: "How do I place an order?",
        a: "Browse our shop, add items to your cart, and proceed to checkout. Fill in your shipping details, select your country (Canada or United States), and complete your payment securely through Stripe.",
      },
      {
        q: "What payment methods do you accept?",
        a: "We accept all major credit and debit cards (Visa, Mastercard, American Express) through our secure Stripe payment system. All transactions are encrypted and secure.",
      },
      {
        q: "Can I modify or cancel my order after placing it?",
        a: "Orders can be modified or cancelled within 1 hour of placement if they haven't been processed yet. Please contact our support team immediately with your order number.",
      },
      {
        q: "How do I know my order was successful?",
        a: "After placing your order, you'll receive an order confirmation page with your order number. You can also view your order anytime in My Orders under your account.",
      },
    ],
  },
  {
    title: "Shipping & Delivery",
    questions: [
      {
        q: "Do you ship internationally?",
        a: "We currently ship to Canada and the United States only. We're working on expanding to more countries in the future.",
      },
      {
        q: "How much does shipping cost?",
        a: "Shipping is free for orders of C$180 or more. For orders below C$180, a delivery fee applies and will be calculated at checkout based on your location.",
      },
      {
        q: "How long does delivery take?",
        a: "Standard delivery within Canada and the US typically takes 5 to 10 business days. Express shipping options may be available at checkout for faster delivery.",
      },
      {
        q: "How can I track my order?",
        a: "Once your order has been shipped, you can track it by logging into your account and visiting My Orders. Your order status will be updated from Processing to Shipped to Delivered.",
      },
    ],
  },
  {
    title: "Returns & Refunds",
    questions: [
      {
        q: "What is your return policy?",
        a: "We accept returns within 14 days of delivery for items that are unused and in their original packaging. Please contact our support team to initiate a return.",
      },
      {
        q: "How do I request a refund?",
        a: "Contact our support team with your order number and reason for the return. Once we receive and inspect the returned item, your refund will be processed within 5 to 10 business days.",
      },
      {
        q: "Can I exchange a product?",
        a: "Yes, you can request an exchange for a different product of the same value within 14 days of delivery. Contact our support team to arrange an exchange.",
      },
    ],
  },
  {
    title: "Account & Profile",
    questions: [
      {
        q: "Do I need an account to shop?",
        a: "Yes, you need to create an account to place orders. This allows you to track your orders, save your shipping address, and manage your profile.",
      },
      {
        q: "How do I create an account?",
        a: "Click the account icon in the top right corner and select Sign Up. Enter your name, email, and password to get started.",
      },
      {
        q: "How do I save my shipping address?",
        a: "Go to My Account > Saved Addresses and add your shipping address. It will be automatically filled in during checkout.",
      },
      {
        q: "I forgot my password. What do I do?",
        a: "Click Sign In, then click Forgot Password. Enter your email address and we'll send you a link to reset your password.",
      },
    ],
  },
  {
    title: "Products",
    questions: [
      {
        q: "Are your products authentic?",
        a: "Yes, all products sold on Arade are 100% authentic. We source directly from authorized distributors and brands.",
      },
      {
        q: "Can I leave a review on a product?",
        a: "Yes! If you've purchased a product, you can leave a verified review after your order is delivered. Go to My Orders, select the order, and click Write a Review on the product.",
      },
      {
        q: "What if a product I want is out of stock?",
        a: "Out of stock products will be clearly marked. We restock regularly, so check back soon or contact us to find out when a product will be available again.",
      },
    ],
  },
];
