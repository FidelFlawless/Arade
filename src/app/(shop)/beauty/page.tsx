import CategoryPage from "@/app/(shop)/category/CategoryPage";

export const metadata = {
  title: "Beauty | Arade",
  description: "Discover beauty essentials curated for your everyday routine.",
};

export default function BeautyPage() {
  return (
    <CategoryPage
      categorySlug="beauty"
      title="Beauty"
      description="Discover beauty essentials curated for your everyday routine. From makeup to fragrances, find everything you need to express your style."
    />
  );
}
