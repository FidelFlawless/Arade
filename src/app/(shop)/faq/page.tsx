import type { Metadata } from "next";
import FaqContent from "./FaqContent";

export const metadata: Metadata = {
  title: "FAQ | Arade",
  description: "Frequently asked questions about Arade products, orders, shipping, returns and more.",
};

export default function FaqPage() {
  return <FaqContent />;
}
