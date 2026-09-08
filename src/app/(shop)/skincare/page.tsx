import CategoryPage from "@/app/(shop)/category/CategoryPage";

export const metadata = {
  title: "Skincare | Arade",
  description: "Carefully selected products for your skincare routine.",
};

export default function SkincarePage() {
  return (
    <CategoryPage
      categorySlug="skincare"
      title="Skincare"
      description="Carefully selected products for your skincare routine. Cleansers, moisturizers, soaps and more to keep your skin healthy and glowing."
    />
  );
}
