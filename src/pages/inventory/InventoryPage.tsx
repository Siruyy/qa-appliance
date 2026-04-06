import { useState, useMemo, useCallback, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Pagination } from "@/components/Pagination";
import { Plus, Package, Download, History } from "lucide-react";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/error";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useProductStore } from "@/stores/productStore";
import type { Product, ProductVariant } from "@/types/product";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ProductFormModal } from "./ProductFormModal";
import { VariantFormModal } from "./VariantFormModal";
import { StockAdjustModal } from "./StockAdjustModal";
import { InventoryToolbar } from "./InventoryToolbar";
import { ProductRow } from "./ProductRow";
import { StockMovementLog } from "./StockMovementLog";
import { downloadCsv } from "@/lib/csv";

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

  // Clamp page when filtered results shrink
  const totalPages = Math.max(1, Math.ceil(allFiltered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);

  const products = useMemo(
    () => allFiltered.slice((page - 1) * pageSize, page * pageSize),
    [allFiltered, page, pageSize]
  );

  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem("inventory-expanded-rows");
      if (stored) return new Set(JSON.parse(stored) as number[]);
    } catch { /* ignore */ }
    return new Set();
  });
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [stockLogOpen, setStockLogOpen] = useState(false);

  const activeProducts = useMemo(() => products.filter((p) => p.is_active), [products]);
  const allActiveSelected = activeProducts.length > 0 && activeProducts.every((p) => selectedIds.has(p.id));

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (activeProducts.every((p) => prev.has(p.id))) {
        return new Set();
      }
      return new Set(activeProducts.map((p) => p.id));
    });
  }, [activeProducts]);

  const handleBulkArchive = async () => {
    if (isArchiving) return;
    setIsArchiving(true);
    const ids = Array.from(selectedIds);
    let archived = 0;
    for (const id of ids) {
      try {
        await archiveProduct(id);
        archived++;
      } catch {
        // continue with remaining
      }
    }
    toast.success(`Archived ${archived} product(s)`);
    setSelectedIds(new Set());
    setBulkArchiveOpen(false);
    setIsArchiving(false);
  };

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("inventory-expanded-rows", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const handleArchiveProduct = async (product: Product) => {
    if (isArchiving) return;
    if (product.is_active) {
      setArchiveTarget(product);
      return;
    }
    setIsArchiving(true);
    try {
      await restoreProduct(product.id);
      toast.success(`"${product.name}" restored`);
    } catch (e) {
      toast.error(extractErrorMessage(e));
    } finally {
      setIsArchiving(false);
    }
  };

  const confirmArchiveProduct = async () => {
    if (!archiveTarget || isArchiving) return;
    const target = archiveTarget;
    setIsArchiving(true);
    try {
      await archiveProduct(target.id);
      toast.success(`"${target.name}" archived`, {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreProduct(target.id);
              toast.success(`"${target.name}" restored`);
            } catch (err) {
              toast.error(extractErrorMessage(err));
            }
          },
        },
      });
    } catch (e) {
      toast.error(extractErrorMessage(e));
    } finally {
      setArchiveTarget(null);
      setIsArchiving(false);
    }
  };

  const handleArchiveVariant = async (variant: ProductVariant) => {
    if (isArchiving) return;
    setIsArchiving(true);
    try {
      await archiveVariant(variant.id);
      toast.success("Variant archived");
    } catch (e) {
      toast.error(extractErrorMessage(e));
    } finally {
      setIsArchiving(false);
    }
  };

  const handleAdjustStock = async (id: number, delta: number) => {
    try {
      await adjustStock(id, delta);
      toast.success("Stock updated");
    } catch (e) {
      toast.error(extractErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Inventory"
        description="Manage products, variants, stock levels, and categories."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStockLogOpen(true)}>
              <History className="mr-1 h-4 w-4" /> Stock Log
            </Button>
            <Button variant="outline" onClick={() => {
              const flat = products.flatMap((p) =>
                (p.variants ?? []).map((v) => ({
                  product: p.name,
                  category: p.category_name ?? "",
                  sku: v.sku ?? "",
                  attributes: v.attributes ? Object.values(v.attributes).join(" / ") : "",
                  cost_price: v.cost_price,
                  selling_price: v.selling_price,
                  stock_qty: v.stock_qty,
                  active: p.is_active ? "Yes" : "No",
                }))
              );
              downloadCsv(flat, "inventory", [
                { key: "product", label: "Product" },
                { key: "category", label: "Category" },
                { key: "sku", label: "SKU" },
                { key: "attributes", label: "Variant" },
                { key: "cost_price", label: "Cost" },
                { key: "selling_price", label: "Price" },
                { key: "stock_qty", label: "Stock" },
                { key: "active", label: "Active" },
              ]);
            }}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
            <Button onClick={() => setModal({ type: "product" })}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>
        }
      />

      <InventoryToolbar
        filters={filters}
        categories={categories}
        selectedCount={selectedIds.size}
        onFilterChange={setFilter}
        onBulkArchive={() => setBulkArchiveOpen(true)}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {/* Table */}
      {loading ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-10" />
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Variants</TableHead>
                <TableHead className="text-right">Total Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableSkeleton cols={8} rows={5} />
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
                <TableHead className="w-10">
                  <Checkbox
                    checked={allActiveSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all products"
                  />
                </TableHead>
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
              {products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  isExpanded={expandedIds.has(product.id)}
                  isSelected={selectedIds.has(product.id)}
                  onToggleExpand={() => toggleExpanded(product.id)}
                  onToggleSelect={() => toggleSelect(product.id)}
                  onEdit={() => setModal({ type: "product", product })}
                  onArchive={() => handleArchiveProduct(product)}
                  onAddVariant={() => setModal({ type: "variant", productId: product.id })}
                  onEditVariant={(variant) =>
                    setModal({ type: "variant", productId: product.id, variant })
                  }
                  onAdjustStock={(variant) => setModal({ type: "stock", variant })}
                  onArchiveVariant={handleArchiveVariant}
                />
              ))}
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
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchiveProduct} disabled={isArchiving}>
              {isArchiving ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkArchiveOpen} onOpenChange={setBulkArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedIds.size} product(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Selected products and their variants will be hidden from active lists. You can restore them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkArchive} disabled={isArchiving}>
              {isArchiving ? "Archiving…" : "Archive All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StockMovementLog open={stockLogOpen} onClose={() => setStockLogOpen(false)} />
    </div>
  );
}


