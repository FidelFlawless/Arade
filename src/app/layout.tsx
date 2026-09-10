import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";
import RecoveryRedirect from "@/components/auth/RecoveryRedirect";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Arade | Beauty, Skincare, Hair & Fashion",
    template: "%s | Arade",
  },
  description:
    "Shop thoughtfully curated beauty, skincare, hair and fashion essentials at Arade, serving customers across Canada and the United States.",
  authors: [{ name: "Arade" }],
  icons: {
    icon: [{ url: "/logo.jpg", type: "image/jpeg" }],
    apple: [{ url: "/logo.jpg", type: "image/jpeg" }],
  },
  alternates: { canonical: absoluteUrl("/") },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: SITE_NAME,
    title: "Arade | Beauty, Skincare, Hair & Fashion",
    description: "Shop thoughtfully curated beauty, skincare, hair and fashion essentials at Arade.",
    url: absoluteUrl("/"),
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), alt: "Arade beauty and fashion products" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arade | Beauty, Skincare, Hair & Fashion",
    description: "Shop thoughtfully curated beauty, skincare, hair and fashion essentials at Arade.",
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
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
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <RecoveryRedirect />
        {children}
      </body>
    </html>
  );
}
