import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function shorten(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trimEnd()}...` : value;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: product } = await supabase
    .from("products")
    .select("name, description, price_cad, images, categories(name)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!product) {
    return new Response("Product not found", { status: 404 });
  }

  const imageUrl = product.images?.[0];
  let productImage = "";
  if (imageUrl) {
    try {
      const imageResponse = await fetch(imageUrl);
      if (imageResponse.ok) {
        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        const imageBuffer = await imageResponse.arrayBuffer();
        productImage = `data:${contentType};base64,${Buffer.from(imageBuffer).toString("base64")}`;
      }
    } catch {
      productImage = "";
    }
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#d5c4a8",
        color: "#2c1810",
        fontFamily: "Georgia, serif",
        padding: "56px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "56%", padding: "24px 24px 24px 0" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 28, letterSpacing: 7, color: "#8b5e3c", marginBottom: 28 }}>ARADE</div>
          <div style={{ fontSize: 18, letterSpacing: 3, color: "#8b5e3c", textTransform: "uppercase", marginBottom: 18 }}>
            {product.categories?.name || "Curated collection"}
          </div>
          <div style={{ fontSize: 48, lineHeight: 1.12, fontWeight: 700, maxWidth: 590 }}>
            {shorten(product.name, 60)}
          </div>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 22, lineHeight: 1.35, marginTop: 22, color: "#6b5045", maxWidth: 560 }}>
            {shorten(product.description || "Discover this curated Arade product.", 115)}
          </div>
        </div>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 30, fontWeight: 700, color: "#8b5e3c" }}>
          C${Number(product.price_cad).toFixed(2)}
        </div>
      </div>
      <div style={{ display: "flex", width: "44%", alignItems: "center", justifyContent: "center", background: "#fffdf9", borderRadius: 20, overflow: "hidden" }}>
        {productImage ? (
          <img src={productImage} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ display: "flex", fontSize: 34, color: "#8b5e3c" }}>Arade</div>
        )}
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
