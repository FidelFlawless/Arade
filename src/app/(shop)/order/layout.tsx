import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Details",
  robots: { index: false, follow: false },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
