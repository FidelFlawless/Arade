import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Check, X } from "lucide-react";
import AddToCartButton from "@/components/product/AddToCartButton";
import ProductImageGallery from "@/components/product/ProductImageGallery";
import { absoluteUrl, JsonLd, truncateDescription } from "@/lib/seo";

const productFallbackDescription = "Shop this curated Arade beauty, skincare, hair or fashion product.";

async function getProduct(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(name, slug, parent_category_id)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product Not Found", robots: { index: false, follow: false } };

  const categoryName = product.categories?.name || "Products";
  const description = truncateDescription(product.description, productFallbackDescription);
  const image = product.images?.[0] ? absoluteUrl(product.images[0]) : absoluteUrl("/image.png");

  return {
    title: product.name,
    description,
    alternates: { canonical: absoluteUrl(`/product/${product.slug}`) },
    openGraph: {
      title: `${product.name} | Arade`,
      description,
      url: absoluteUrl(`/product/${product.slug}`),
      type: "website",
      siteName: "Arade",
      images: [{ url: image, alt: product.name }],
    },
    twitter: { card: "summary_large_image", title: `${product.name} | Arade`, description, images: [image] },
    other: { "product:category": categoryName },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const product = await getProduct(slug);

  // Fetch parent category if this is a subcategory
  let parentCategory: { name: string; slug: string } | null = null;
  if (product?.categories?.parent_category_id) {
    const { data: parent } = await supabase
      .from("categories")
      .select("name, slug")
      .eq("id", product.categories.parent_category_id)
      .single();
    parentCategory = parent;
  }

  
  let approvedReviews: any[] = [];
  let avgRating = 0;
  let reviewCount = 0;
  if (product) {
    const { data: revs } = await supabase
      .from("reviews")
      .select("*, profiles(full_name)")
      .eq("product_id", product.id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false });
    approvedReviews = revs || [];
    reviewCount = approvedReviews.length;
    if (reviewCount > 0) {
      avgRating = Math.round((approvedReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewCount) * 10) / 10;
    }
  }

  let relatedProducts: any[] = [];
  if (product) {
    const { data: related } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .eq("category_id", product.category_id)
      .neq("id", product.id)
      .limit(4);
    relatedProducts = related || [];
  }

  if (!product) {
    notFound();
  }

  const categoryName = product.categories?.name || "Products";
  const categorySlug = product.categories?.slug || "";
  const parentSlug = parentCategory?.slug || categorySlug;
  const parentName = parentCategory?.name || categoryName;
  const isSubcategory = !!parentCategory;
  const productSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: (product.images || []).map((image: string) => absoluteUrl(image)),
    category: categoryName,
    sku: product.id,
    url: absoluteUrl(`/product/${product.slug}`),
    offers: [
      {
        "@type": "Offer",
        url: absoluteUrl(`/product/${product.slug}`),
        priceCurrency: "CAD",
        price: product.price_cad,
        availability: product.stock_quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
      },
      {
        "@type": "Offer",
        url: absoluteUrl(`/product/${product.slug}`),
        priceCurrency: "USD",
        price: product.price_usd,
        availability: product.stock_quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
      },
    ],
  };
  if (reviewCount > 0) {
    productSchema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: avgRating,
      reviewCount,
    };
  }

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            productSchema,
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
                { "@type": "ListItem", position: 2, name: parentName, item: absoluteUrl(`/${parentSlug}`) },
                { "@type": "ListItem", position: 3, name: product.name, item: absoluteUrl(`/product/${product.slug}`) },
              ],
            },
          ],
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-foreground/60 mb-8">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/shop" className="hover:text-primary">Shop</Link>
        <span className="mx-2">/</span>
        <Link href={`/${parentSlug}`} className="hover:text-primary">{parentName}</Link>
        {isSubcategory && (
          <>
            <span className="mx-2">/</span>
            <span className="text-foreground">{categoryName}</span>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
        {/* Product Image Gallery */}
        <div className="lg:col-span-2">
          <ProductImageGallery images={product.images || []} name={product.name} />
        </div>

        {/* Product Info */}
        <div className="lg:col-span-3">
          <p className="text-primary text-sm font-medium uppercase tracking-wider">{categoryName}</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-foreground">{product.name}</h1>

          <div className="mt-4 flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">C${product.price_cad}</span>
            {product.price_usd > 0 && (
              <span className="text-lg text-foreground/50">US${product.price_usd}</span>
            )}
          </div>

          <p className="mt-6 text-foreground/70 leading-relaxed">{product.description}</p>

          {/* Stock */}
          <div className="mt-6">
            {product.stock_quantity > 0 ? (
              <p className="text-green-600 font-medium flex items-center gap-1"><Check className="w-4 h-4" /> In Stock ({product.stock_quantity} available)</p>
            ) : (
              <p className="text-red-500 font-medium flex items-center gap-1"><X className="w-4 h-4" /> Out of Stock</p>
            )}
          </div>

          {/* Add to Cart - Client Component */}
          <AddToCartButton product={product} />

          {/* Details */}
          <div className="mt-10 space-y-6 border-t border-border pt-8">
            {product.ingredients && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Ingredients</h3>
                <p className="text-foreground/60 text-sm">{product.ingredients}</p>
              </div>
            )}
            {product.benefits && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">Benefits</h3>
                <p className="text-foreground/60 text-sm">{product.benefits}</p>
              </div>
            )}
            {product.how_to_use && (
              <div>
                <h3 className="font-semibold text-foreground mb-2">How to Use</h3>
                <p className="text-foreground/60 text-sm">{product.how_to_use}</p>
              </div>
            )}
          </div>

          {/* Trust badges */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-foreground/60">Free Delivery</p>
              <p className="text-xs font-medium text-foreground">Orders $180+</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-foreground/60">Secure Payment</p>
              <p className="text-xs font-medium text-foreground">Stripe</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-foreground/60">Canada & USA</p>
              <p className="text-xs font-medium text-foreground">Shipping</p>
            </div>
          </div>
        </div>
      </div>

      
      {/* Reviews Section */}
      {reviewCount > 0 && (
        <div className="mt-16 border-t border-border pt-12">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-2xl font-bold text-foreground">Customer Reviews</h2>
            <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full">
              <div className="flex">
                {[1,2,3,4,5].map((s) => (
                  <svg key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
              </div>
              <span className="text-sm font-medium text-foreground">{avgRating}</span>
              <span className="text-sm text-foreground/50">({reviewCount} review{reviewCount !== 1 ? "s" : ""})</span>
            </div>
          </div>
          <div className="space-y-6">
            {approvedReviews.map((rev) => (
              <div key={rev.id} className="border-b border-border pb-6 last:border-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">
                    {[1,2,3,4,5].map((s) => (
                      <svg key={s} className={`w-4 h-4 ${s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    ))}
                  </div>
                  {rev.is_verified && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      Verified Purchase
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">{rev.profiles?.full_name || "Customer"}</p>
                <p className="text-sm text-foreground/50">{new Date(rev.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                {rev.comment && <p className="mt-2 text-foreground/70">{rev.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-foreground mb-8">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {relatedProducts.map((rp) => (
              <a key={rp.id} href={"/product/" + rp.slug} className="group card p-0 hover:shadow-lg">
                <div className="aspect-[4/3] bg-muted relative overflow-hidden rounded-t-lg">
                  {rp.images && rp.images[0] ? (
                    <img src={rp.images[0]} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-foreground/30">No Image</div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-foreground text-sm line-clamp-2 hover:text-primary transition-colors">{rp.name}</h3>
                  <p className="mt-2 text-primary font-bold">C{rp.price_cad}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
      </div>
    </>
  );
}
