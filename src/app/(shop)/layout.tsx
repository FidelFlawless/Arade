import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { CartProvider } from "@/components/providers/CartProvider";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import WelcomePromoModal from "@/components/promo/WelcomePromoModal";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <CartProvider>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <WhatsAppButton />
          <WelcomePromoModal />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}
