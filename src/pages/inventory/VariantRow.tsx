import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import { useCurrency } from "@/hooks/useCurrency";
import type { ProductVariant } from "@/types/product";
import { MoreHorizontal, Pencil, Package, Archive } from "lucide-react";

interface VariantRowProps {
  variant: ProductVariant;
  onEdit: () => void;
  onAdjustStock: () => void;
  onArchive: () => void;
}

/** Renders a single product variant as a sub-row in the inventory table. */
export function VariantRow({ variant, onEdit, onAdjustStock, onArchive }: VariantRowProps) {
  const attrs = variant.attributes
    ? Object.entries(variant.attributes as Record<string, string>)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "—";

  const { format: formatCurrency } = useCurrency();

  const stockBadge = () => {
    if (!variant.is_active) return <Badge variant="secondary">Archived</Badge>;
    if (variant.stock_qty === 0)
      return <Badge variant="destructive">Out of Stock</Badge>;
    if (variant.stock_qty <= variant.low_stock_threshold)
      return <Badge className="bg-warning text-warning-foreground">Low Stock</Badge>;
    return <Badge variant="outline">In Stock</Badge>;
  };

  return (
    <TableRow className="bg-muted/30">
      <TableCell />
      <TableCell className="pl-8 text-sm text-muted-foreground">
        <span className="font-mono text-xs">{variant.sku || "No SKU"}</span>
        <span className="ml-2">{attrs}</span>
      </TableCell>
      <TableCell />
      <TableCell className="text-right text-sm">
        {formatCurrency(variant.selling_price)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm">
        {variant.stock_qty}
      </TableCell>
      <TableCell>{stockBadge()}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent hover:text-accent-foreground" title="Variant actions">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Variant
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAdjustStock}>
              <Package className="mr-2 h-4 w-4" />
              Adjust Stock
            </DropdownMenuItem>
            {variant.is_active && (
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
