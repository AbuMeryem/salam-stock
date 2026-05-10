"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export function ProductCard({ product, supplierName }: { product: Product; supplierName?: string }) {
  const lowStock = product.stock_theoretical <= product.stock_min;
  return (
    <Link
      href={`/catalogue/${product.id}`}
      className="block bg-white rounded-[20px] shadow-card overflow-hidden active:scale-[0.99] transition-transform"
    >
      <div
        className="aspect-square bg-cream bg-cover bg-center relative"
        style={{ backgroundImage: `url(${product.image_url})` }}
      >
        {lowStock && (
          <span className="absolute top-2 left-2 badge badge-danger text-[10px]">
            Stock bas
          </span>
        )}
        <span className="absolute bottom-2 left-2 badge badge-neutral !bg-white/85 text-[10px]">
          {product.category}
        </span>
      </div>
      <div className="p-3">
        <p className="text-[13px] font-bold text-text-primary leading-tight line-clamp-2 min-h-[34px]">
          {product.name}
        </p>
        <p className="text-[11px] text-text-tertiary mt-0.5 truncate">
          {product.brand}
          {supplierName ? ` · ${supplierName.split(" ")[0]}` : ""}
        </p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-base font-extrabold text-primary">
            {formatCurrency(product.sale_price)}
          </p>
          <span className={cn(
            "text-[11px] font-semibold inline-flex items-center gap-0.5",
            lowStock ? "text-danger" : "text-text-secondary"
          )}>
            <Package className="w-3 h-3" />
            {product.stock_theoretical}
          </span>
        </div>
      </div>
    </Link>
  );
}
