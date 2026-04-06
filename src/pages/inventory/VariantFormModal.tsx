import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { useProducts } from "@/hooks/useProducts";
import { variantSchema, type VariantFormData } from "@/lib/validations/product";
import type { ProductVariant } from "@/types/product";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { extractErrorMessage } from '@/lib/error';

interface Props {
  productId: number;
  variant?: ProductVariant;
  onClose: () => void;
}

export function VariantFormModal({ productId, variant, onClose }: Props) {
  const isEdit = !!variant;
  const { createVariant, updateVariant } = useProducts();

  // Convert Record<string,string> → array for form
  const existingAttrs = variant?.attributes
    ? Object.entries(variant.attributes as Record<string, string>).map(([key, value]) => ({
        key,
        value,
      }))
    : [{ key: "", value: "" }];

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VariantFormData>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      product_id: productId,
      sku: variant?.sku ?? "",
      attributes: existingAttrs,
      cost_price: variant?.cost_price ?? 0,
      selling_price: variant?.selling_price ?? 0,
      stock_qty: variant?.stock_qty ?? 0,
      low_stock_threshold: variant?.low_stock_threshold ?? 2,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "attributes",
  });

  const onSubmit = async (data: VariantFormData) => {
    try {
      // Convert array back to Record<string,string>
      const attrRecord: Record<string, string> = {};
      for (const { key, value } of data.attributes) {
        if (key.trim()) attrRecord[key.trim()] = value.trim();
      }

      if (isEdit) {
        await updateVariant({
          id: variant.id,
          sku: data.sku || undefined,
          attributes: attrRecord,
          cost_price: data.cost_price,
          selling_price: data.selling_price,
          stock_qty: data.stock_qty,
          low_stock_threshold: data.low_stock_threshold,
        });
        toast.success("Variant updated");
      } else {
        await createVariant({
          product_id: data.product_id,
          sku: data.sku || undefined,
          attributes: attrRecord,
          cost_price: data.cost_price,
          selling_price: data.selling_price,
          stock_qty: data.stock_qty,
          low_stock_threshold: data.low_stock_threshold,
        });
        toast.success("Variant created");
      }
      onClose();
    } catch (e) {
      toast.error(extractErrorMessage(e));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Variant" : "New Variant"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* SKU */}
          <div className="space-y-2">
            <Label htmlFor="variant-sku">SKU (optional)</Label>
            <Input id="variant-sku" {...register("sku")} placeholder="e.g. SAM-INV-1HP" />
          </div>

          {/* Dynamic Attributes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attributes</Label>
              {fields.length < 5 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => append({ key: "", value: "" })}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              )}
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    {...register(`attributes.${index}.key`)}
                    placeholder="e.g. Size"
                  />
                  {errors.attributes?.[index]?.key && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.attributes[index].key?.message}
                    </p>
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    {...register(`attributes.${index}.value`)}
                    placeholder="e.g. 1.0 HP"
                  />
                  {errors.attributes?.[index]?.value && (
                    <p className="text-xs text-destructive mt-1">
                      {errors.attributes[index].value?.message}
                    </p>
                  )}
                </div>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => remove(index)}
                    aria-label="Remove variant"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {errors.attributes?.message && (
              <p className="text-sm text-destructive">{errors.attributes.message}</p>
            )}
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost-price">Cost Price (₱)</Label>
              <Input
                id="cost-price"
                type="number"
                step="0.01"
                min="0"
                {...register("cost_price", { valueAsNumber: true })}
              />
              {errors.cost_price && (
                <p className="text-sm text-destructive">{errors.cost_price.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="selling-price">Selling Price (₱)</Label>
              <Input
                id="selling-price"
                type="number"
                step="0.01"
                min="0"
                {...register("selling_price", { valueAsNumber: true })}
              />
              {errors.selling_price && (
                <p className="text-sm text-destructive">{errors.selling_price.message}</p>
              )}
            </div>
          </div>

          {/* Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock-qty">Stock Quantity</Label>
              <Input
                id="stock-qty"
                type="number"
                {...register("stock_qty", { valueAsNumber: true })}
              />
              {errors.stock_qty && (
                <p className="text-sm text-destructive">{errors.stock_qty.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="low-threshold">Low Stock Threshold</Label>
              <Input
                id="low-threshold"
                type="number"
                {...register("low_stock_threshold", { valueAsNumber: true })}
              />
              {errors.low_stock_threshold && (
                <p className="text-sm text-destructive">{errors.low_stock_threshold.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
