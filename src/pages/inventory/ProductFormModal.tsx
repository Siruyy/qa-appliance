import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { useProducts } from "@/hooks/useProducts";
import { useProductStore } from "@/stores/productStore";
import { productSchema, type ProductFormData } from "@/lib/validations/product";
import type { Product } from "@/types/product";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractErrorMessage } from '@/lib/error';

interface Props {
  product?: Product;
  onClose: () => void;
}

export function ProductFormModal({ product, onClose }: Props) {
  const isEdit = !!product;
  const { createProduct, updateProduct } = useProducts();
  const categories = useProductStore((s) => s.categories);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      category_id: product?.category_id ?? undefined,
      description: product?.description ?? "",
    },
  });

  const categoryId = watch("category_id");

  const onSubmit = async (data: ProductFormData) => {
    try {
      if (isEdit) {
        await updateProduct({
          id: product.id,
          name: data.name,
          category_id: data.category_id,
          description: data.description || undefined,
        });
        toast.success("Product updated");
      } else {
        await createProduct({
          name: data.name,
          category_id: data.category_id,
          description: data.description || undefined,
        });
        toast.success("Product created");
      }
      onClose();
    } catch (e) {
      toast.error(extractErrorMessage(e));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => { if (isSubmitting) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "New Product"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={categoryId?.toString() ?? ""}
              onValueChange={(v) => setValue("category_id", Number(v), { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category…" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category_id && (
              <p className="text-sm text-destructive">{errors.category_id.message}</p>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="product-name">Product Name</Label>
            <Input id="product-name" {...register("name")} placeholder="e.g. Samsung Inverter AC" />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="product-desc">Description (optional)</Label>
            <Textarea
              id="product-desc"
              {...register("description")}
              placeholder="Brief product description…"
              rows={3}
            />
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
