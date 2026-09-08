import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Arade - Beauty, Skincare, Hair & Fashion",
    template: "%s | Arade",
  },
  description:
    "Your destination for beauty, skincare, hair and fashion. Curated products to elevate your everyday routine. Free delivery on orders $180+.",
  keywords: [
    "beauty",
    "skincare",
    "hair",
    "fashion",
    "wigs",
    "makeup",
    "online shopping",
    "Canada",
    "USA",
  ],
  authors: [{ name: "Arade" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Arade",
    title: "Arade - Beauty, Skincare, Hair & Fashion",
    description:
      "Professional skincare products for radiant, healthy skin. Shop cleansers, moisturizers, serums, and more.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
