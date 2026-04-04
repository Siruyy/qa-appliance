import { useState, useMemo } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
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

export function ProductSearchDropdown({ onSelect, excludeVariantIds = [] }: ProductSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const products = useProductStore((s) => s.products);

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

  const { format: formatCurrency } = useCurrency();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button variant="outline" className="w-full justify-between gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Search products...</span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[460px] p-0">
        <Command>
          <CommandInput placeholder="Type product name or SKU..." />
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.variant.id}
                  value={`${opt.label} ${opt.variant.sku ?? ""}`}
                  onSelect={() => {
                    onSelect(opt);
                    setOpen(false);
                  }}
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
