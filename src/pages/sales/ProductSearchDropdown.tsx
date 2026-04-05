import { useState, useMemo, useCallback } from "react";
import { ChevronsUpDown, Search, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCurrency } from "@/hooks/useCurrency";
import { Badge } from "@/components/ui/badge";
import { useProductStore } from "@/stores/productStore";
import type { Product, ProductVariant } from "@/types/product";

interface VariantOption {
  product: Product;
  variant: ProductVariant;
  label: string;
}

interface ProductSearchDropdownProps {
  onSelect: (option: VariantOption) => void;
  excludeVariantIds?: number[];
}

function variantLabel(product: Product, variant: ProductVariant): string {
  const attrs = variant.attributes
    ? Object.entries(variant.attributes)
        .map(([, v]) => v)
        .join(" / ")
    : "";
  return attrs ? `${product.name} — ${attrs}` : product.name;
}

const RECENT_KEY = "qa-recent-products";
const MAX_RECENT = 5;

function getRecentVariantIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function addRecentVariantId(id: number) {
  const ids = getRecentVariantIds().filter((v) => v !== id);
  ids.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}

export function ProductSearchDropdown({ onSelect, excludeVariantIds = [] }: ProductSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const products = useProductStore((s) => s.products);
  const [recentIds, setRecentIds] = useState(getRecentVariantIds);

  const options = useMemo(() => {
    const result: VariantOption[] = [];
    for (const product of products) {
      if (!product.is_active) continue;
      for (const variant of product.variants ?? []) {
        if (!variant.is_active || variant.stock_qty <= 0) continue;
        if (excludeVariantIds.includes(variant.id)) continue;
        result.push({
          product,
          variant,
          label: variantLabel(product, variant),
        });
      }
    }
    return result;
  }, [products, excludeVariantIds]);

  const recentOptions = useMemo(() => {
    return recentIds
      .map((id) => options.find((o) => o.variant.id === id))
      .filter((o): o is VariantOption => !!o);
  }, [recentIds, options]);

  const handleSelect = useCallback((opt: VariantOption) => {
    addRecentVariantId(opt.variant.id);
    setRecentIds(getRecentVariantIds());
    onSelect(opt);
    setOpen(false);
  }, [onSelect]);

  const { format: formatCurrency } = useCurrency();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="outline" className="w-full justify-between gap-2" />}
      >
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Search products...</span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[460px] p-0">
        <Command>
          <CommandInput placeholder="Type product name or SKU..." />
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            {recentOptions.length > 0 && (
              <CommandGroup heading="Recently selected">
                {recentOptions.map((opt) => (
                  <CommandItem
                    key={`recent-${opt.variant.id}`}
                    value={`recent ${opt.label} ${opt.variant.sku ?? ""}`}
                    onSelect={() => handleSelect(opt)}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{opt.label}</span>
                      </div>
                      <span className="font-medium text-sm">
                        {formatCurrency(opt.variant.selling_price)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading={recentOptions.length > 0 ? "All products" : undefined}>
              {options.map((opt) => (
                <CommandItem
                  key={opt.variant.id}
                  value={`${opt.label} ${opt.variant.sku ?? ""} ${opt.product.category_name ?? ""}`}
                  onSelect={() => handleSelect(opt)}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">{opt.label}</span>
                      {opt.variant.sku && (
                        <span className="text-xs text-muted-foreground">SKU: {opt.variant.sku}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Stock: {opt.variant.stock_qty}
                      </Badge>
                      <span className="font-medium text-sm">
                        {formatCurrency(opt.variant.selling_price)}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
