import CategoryPage from "@/app/(shop)/category/CategoryPage";

export const metadata = {
  title: "Hair | Arade",
  description: "Explore wigs and hair essentials.",
};

export default function HairPage() {
  return (
    <CategoryPage
      categorySlug="hair"
      title="Hair"
      description="Explore wigs, hair care and accessories. Quality products to help you achieve your desired look."
    />
  );
}
