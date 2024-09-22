import prisma from "@/app/lib/db";
import { LoadingProductCard, ProductCard } from "./ProductCard";
import { Suspense } from "react";
import { unstable_noStore as noStore, revalidatePath } from "next/cache";

async function getData() {
  const data = await prisma.product.findMany({
    where: {
      status: "published",
      isFeatured: true,
    },
    
    orderBy: {
      createdAt: "desc",
    },
    take: 12,
  });

  return data;
}

export function FeaturedProducts() {
  return (
    <>
      <h2 className="text-2xl font-medium tracking-tight uppercase">Produse Recomandate</h2>
      <Suspense fallback={<LoadingRows />}>
        <LoadFeaturedproducts />
      </Suspense>
    </>
  );
}

async function LoadFeaturedproducts() {
  noStore();
  const data = await getData();

  return (
    <div className="mt-5 grid  md:grid-cols-3 lg:grid-cols-4 gap-5">
      {data.map((item) => (
        <ProductCard loading key={item.id} item={item} />
      ))}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <LoadingProductCard />
      <LoadingProductCard />
      <LoadingProductCard />
    </div>
  );
}