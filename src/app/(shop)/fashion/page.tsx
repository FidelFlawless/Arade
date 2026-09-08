import CategoryPage from "@/app/(shop)/category/CategoryPage";

export const metadata = {
  title: "Fashion | Arade",
  description: "Find pieces that express your personal style.",
};

export default function FashionPage() {
  return (
    <CategoryPage
      categorySlug="fashion"
      title="Fashion"
      description="Find pieces that express your personal style. Dresses, tops and accessories curated for every occasion."
    />
  );
}
