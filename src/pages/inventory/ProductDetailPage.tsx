import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Archive,
  RotateCcw,
  PackagePlus,
  Tag,
  FileText,
  Boxes,
  Hash,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";

import { useProducts } from "@/hooks/useProducts";
import { useCurrency } from "@/hooks/useCurrency";
import { formatDate } from "@/lib/formatters";
import { extractErrorMessage } from "@/lib/error";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { Product, ProductVariant } from "@/types/product";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { MoreHorizontal, Package } from "lucide-react";

import { VariantFormModal } from "./VariantFormModal";
import { StockMovementSection } from "./StockMovementSection";
import { SerialNumberSection } from "./SerialNumberSection";

// Lazy import the stock adjust modal if it exists
import { StockAdjustModal } from "./StockAdjustModal";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getProductById,
    archiveProduct,
    restoreProduct,
    archiveVariant,
    adjustStock,
  } = useProducts();
  const { format: formatCurrency } = useCurrency();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [variantModal, setVariantModal] = useState<{
    open: boolean;
    variant?: ProductVariant;
  }>({ open: false });
  const [adjustModal, setAdjustModal] = useState<{
    open: boolean;
    variant?: ProductVariant;
  }>({ open: false });

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getProductById(Number(id));
      setProduct(data);
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [id, getProductById]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Product not found.
      </div>
    );
  }

  const variants = (product.variants ?? []).filter((v) => v.is_active);
  const archivedVariants = (product.variants ?? []).filter((v) => !v.is_active);
  const allVariants = product.variants ?? [];
  const totalStock = variants.reduce((sum, v) => sum + v.stock_qty, 0);

  const handleArchive = async () => {
    try {
      await archiveProduct(product.id);
      toast.success("Product archived");
      navigate("/inventory");
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const handleRestore = async () => {
    try {
      await restoreProduct(product.id);
      toast.success("Product restored");
      await fetchProduct();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const handleArchiveVariant = async (variantId: number) => {
    try {
      await archiveVariant(variantId);
      toast.success("Variant archived");
      await fetchProduct();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    }
  };

  const stockBadge = (variant: ProductVariant) => {
    if (!variant.is_active) return <Badge variant="secondary">Archived</Badge>;
    if (variant.stock_qty === 0)
      return <Badge variant="destructive">Out of Stock</Badge>;
    if (variant.stock_qty <= variant.low_stock_threshold)
      return <Badge className="bg-warning text-warning-foreground">Low Stock</Badge>;
    return <Badge variant="outline">In Stock</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Inventory", to: "/inventory" },
          { label: product.name },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/inventory")}
            aria-label="Back to inventory"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{product.name}</h1>
              {!product.is_active && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVariantModal({ open: true })}
          >
            <PackagePlus className="mr-1 h-4 w-4" /> Add Variant
          </Button>
          {product.is_active ? (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="mr-1 h-4 w-4" /> Archive
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleRestore}>
              <RotateCcw className="mr-1 h-4 w-4" /> Restore
            </Button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
        {product.category_name && (
          <span className="flex items-center gap-1">
            <Tag className="h-4 w-4" /> {product.category_name}
          </span>
        )}
        {product.description && (
          <span className="flex items-center gap-1">
            <FileText className="h-4 w-4" /> {product.description}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Boxes className="h-4 w-4" /> Total Stock: {totalStock}
        </span>
        <span>Created: {formatDate(product.created_at)}</span>
      </div>

      <Separator />

      {/* Variants Section */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Package className="h-5 w-5" />
          Variants ({variants.length})
        </h2>

        {variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active variants.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Attributes</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Installment</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((v) => {
                  const attrs = v.attributes
                    ? Object.entries(v.attributes as Record<string, string>)
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(", ")
                    : "—";

                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-sm">
                        {v.sku || "No SKU"}
                      </TableCell>
                      <TableCell className="text-sm">{attrs}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(v.cost_price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(v.selling_price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {v.installment_price != null
                          ? formatCurrency(v.installment_price)
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {v.stock_qty}
                      </TableCell>
                      <TableCell>{stockBadge(v)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground space-y-0.5">
                        {v.last_stocked_at && (
                          <div title="Last stocked">↑ {formatDate(v.last_stocked_at)}</div>
                        )}
                        {v.last_released_at && (
                          <div title="Last released/sold">↓ {formatDate(v.last_released_at)}</div>
                        )}
                        {!v.last_stocked_at && !v.last_released_at && "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                            title="Variant actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setVariantModal({ open: true, variant: v })}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setAdjustModal({ open: true, variant: v })}
                            >
                              <Package className="mr-2 h-4 w-4" /> Adjust Stock
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleArchiveVariant(v.id)}
                            >
                              <Archive className="mr-2 h-4 w-4" /> Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {archivedVariants.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            + {archivedVariants.length} archived variant(s)
          </p>
        )}
      </section>

      <Separator />

      {/* Serial Numbers Section */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Hash className="h-5 w-5" />
          Serial Numbers
        </h2>
        <SerialNumberSection variants={allVariants} />
      </section>

      <Separator />

      {/* Stock Movement History Section */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <ArrowUpDown className="h-5 w-5" />
          Stock Movement History
        </h2>
        <StockMovementSection productId={product.id} variants={allVariants} />
      </section>

      {/* Variant Form Modal */}
      {variantModal.open && (
        <VariantFormModal
          productId={product.id}
          variant={variantModal.variant}
          onClose={() => {
            setVariantModal({ open: false });
            fetchProduct();
          }}
        />
      )}

      {/* Stock Adjust Modal */}
      {adjustModal.open && adjustModal.variant && (
        <StockAdjustModal
          variant={adjustModal.variant}
          onAdjust={async (variantId, delta, serials) => {
            await adjustStock(variantId, delta, serials);
          }}
          onClose={() => {
            setAdjustModal({ open: false });
            fetchProduct();
          }}
        />
      )}
    </div>
  );
}
