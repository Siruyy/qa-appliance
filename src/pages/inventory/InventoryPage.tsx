import { useState, useMemo, Fragment } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Pagination } from "@/components/Pagination";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Package,
  Archive,
  RotateCcw,
  Pencil,
  PackagePlus,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useProductStore } from "@/stores/productStore";
import { useCurrency } from "@/hooks/useCurrency";
import type { Product, ProductVariant } from "@/types/product";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ProductFormModal } from "./ProductFormModal";
import { VariantFormModal } from "./VariantFormModal";
import { StockAdjustModal } from "./StockAdjustModal";

type ModalState =
  | { type: "none" }
  | { type: "product"; product?: Product }
  | { type: "variant"; productId: number; variant?: ProductVariant }
  | { type: "stock"; variant: ProductVariant };

export function InventoryPage() {
  const { archiveProduct, restoreProduct, archiveVariant, adjustStock } = useProducts();
  useCategories();

  const { categories, loading, filters, setFilter, filteredProducts, products: rawProducts, page, pageSize, setPage } = useProductStore();
  const allFiltered = useMemo(() => filteredProducts(), [rawProducts, filters]);
  const products = useMemo(
    () => allFiltered.slice((page - 1) * pageSize, page * pageSize),
    [allFiltered, page, pageSize]
  );

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleArchiveProduct = async (product: Product) => {
    if (product.is_active) {
      setArchiveTarget(product);
      return;
    }
    try {
      await restoreProduct(product.id);
      toast.success(`"${product.name}" restored`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const confirmArchiveProduct = async () => {
    if (!archiveTarget) return;
    try {
      await archiveProduct(archiveTarget.id);
      toast.success(`"${archiveTarget.name}" archived`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setArchiveTarget(null);
    }
  };

  const handleArchiveVariant = async (variant: ProductVariant) => {
    try {
      await archiveVariant(variant.id);
      toast.success("Variant archived");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleAdjustStock = async (id: number, delta: number) => {
    try {
      await adjustStock(id, delta);
      toast.success("Stock updated");
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Inventory"
        description="Manage products, variants, stock levels, and categories."
        actions={
          <Button onClick={() => setModal({ type: "product" })}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, SKU…"
            className="pl-9"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
          />
        </div>

        <Select
          value={filters.categoryId?.toString() ?? "all"}
          onValueChange={(v) => setFilter("categoryId", v === "all" ? null : Number(v))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(v) => setFilter("status", v as "all" | "active" | "archived")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Variants</TableHead>
                <TableHead className="text-right">Total Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableSkeleton cols={7} rows={5} />
          </Table>
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description="Add your first product to get started with inventory management."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Variants</TableHead>
                <TableHead className="text-right">Total Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const isExpanded = expandedIds.has(product.id);
                const variants = product.variants ?? [];
                const totalStock = variants.reduce((sum, v) => sum + v.stock_qty, 0);
                const hasLowStock = variants.some(
                  (v) => v.is_active && v.stock_qty > 0 && v.stock_qty <= v.low_stock_threshold
                );
                const hasOutOfStock = variants.some((v) => v.is_active && v.stock_qty === 0);

                return (
                  <Fragment key={product.id}>
                    {/* Product Row */}
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpanded(product.id)}
                    >
                      <TableCell>
                        {variants.length > 0 &&
                          (isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          ))}
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
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
                          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent hover:text-accent-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setModal({ type: "product", product })}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setModal({ type: "variant", productId: product.id })
                              }
                            >
                              <PackagePlus className="mr-2 h-4 w-4" />
                              Add Variant
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleArchiveProduct(product)}
                            >
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

                    {/* Variant Rows */}
                    {isExpanded &&
                      variants.map((variant) => (
                        <VariantRow
                          key={`v-${variant.id}`}
                          variant={variant}
                          onEdit={() =>
                            setModal({
                              type: "variant",
                              productId: product.id,
                              variant,
                            })
                          }
                          onAdjustStock={() => setModal({ type: "stock", variant })}
                          onArchive={() => handleArchiveVariant(variant)}
                        />
                      ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={allFiltered.length}
        onPageChange={setPage}
      />

      {/* Modals */}
      {modal.type === "product" && (
        <ProductFormModal
          product={modal.product}
          onClose={() => setModal({ type: "none" })}
        />
      )}
      {modal.type === "variant" && (
        <VariantFormModal
          productId={modal.productId}
          variant={modal.variant}
          onClose={() => setModal({ type: "none" })}
        />
      )}
      {modal.type === "stock" && (
        <StockAdjustModal
          variant={modal.variant}
          onAdjust={handleAdjustStock}
          onClose={() => setModal({ type: "none" })}
        />
      )}

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this product?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{archiveTarget?.name}&rdquo; and its variants will be hidden from active lists. You can restore them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchiveProduct}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Variant sub-row ──

function VariantRow({
  variant,
  onEdit,
  onAdjustStock,
  onArchive,
}: {
  variant: ProductVariant;
  onEdit: () => void;
  onAdjustStock: () => void;
  onArchive: () => void;
}) {
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
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent hover:text-accent-foreground">
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
