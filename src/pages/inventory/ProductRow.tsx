import { Fragment } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Archive,
  RotateCcw,
  Pencil,
  PackagePlus,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Product, ProductVariant } from "@/types/product";
import { VariantRow } from "./VariantRow";

interface ProductRowProps {
  product: Product;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onAddVariant: () => void;
  onEditVariant: (variant: ProductVariant) => void;
  onAdjustStock: (variant: ProductVariant) => void;
  onArchiveVariant: (variant: ProductVariant) => void;
}

export function ProductRow({
  product,
  isExpanded,
  isSelected,
  onToggleExpand,
  onToggleSelect,
  onEdit,
  onArchive,
  onAddVariant,
  onEditVariant,
  onAdjustStock,
  onArchiveVariant,
}: ProductRowProps) {
  const navigate = useNavigate();
  const variants = product.variants ?? [];
  const totalStock = variants.reduce((sum, v) => sum + v.stock_qty, 0);
  const hasLowStock = variants.some(
    (v) => v.is_active && v.stock_qty > 0 && v.stock_qty <= v.low_stock_threshold
  );
  const hasOutOfStock = variants.some((v) => v.is_active && v.stock_qty === 0);

  return (
    <Fragment>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggleExpand}
      >
        <TableCell onClick={(e) => e.stopPropagation()}>
          {product.is_active && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              aria-label={`Select ${product.name}`}
            />
          )}
        </TableCell>
        <TableCell>
          {variants.length > 0 &&
            (isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            ))}
        </TableCell>
        <TableCell className="font-medium">
          <Link
            to={`/inventory/${product.id}`}
            className="hover:underline text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            {product.name}
          </Link>
        </TableCell>
        <TableCell>{product.category_name ?? "—"}</TableCell>
        <TableCell className="text-right">{variants.length}</TableCell>
        <TableCell className="text-right tabular-nums">
          <span className="flex items-center justify-end gap-1.5">
            {totalStock}
            {hasOutOfStock && (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            {hasLowStock && !hasOutOfStock && (
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            )}
          </span>
        </TableCell>
        <TableCell>
          {product.is_active ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">Archived</Badge>
          )}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent hover:text-accent-foreground"
              title="Product actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/inventory/${product.id}`)  }>
                <ExternalLink className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAddVariant}>
                <PackagePlus className="mr-2 h-4 w-4" />
                Add Variant
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onArchive}>
                {product.is_active ? (
                  <>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {isExpanded &&
        variants.map((variant) => (
          <VariantRow
            key={`v-${variant.id}`}
            variant={variant}
            onEdit={() => onEditVariant(variant)}
            onAdjustStock={() => onAdjustStock(variant)}
            onArchive={() => onArchiveVariant(variant)}
          />
        ))}
    </Fragment>
  );
}
