import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(100, "Max 100 characters"),
  description: z.string().trim().optional().or(z.literal("")),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

export const productSchema = z.object({
  category_id: z.number({ error: "Category is required" }).int().positive("Select a category"),
  name: z.string().trim().min(1, "Product name is required").max(200, "Max 200 characters"),
  description: z.string().trim().optional().or(z.literal("")),
});

export type ProductFormData = z.infer<typeof productSchema>;

export const variantSchema = z
  .object({
    product_id: z.number().int().positive(),
    sku: z.string().trim().optional().or(z.literal("")),
    attributes: z
      .array(
        z.object({
          key: z.string().trim().min(1, "Attribute name required"),
          value: z.string().trim().min(1, "Attribute value required"),
        })
      )
      .min(1, "At least one attribute is required")
      .max(5, "Max 5 attributes"),
    cost_price: z.number({ error: "Cost price is required" }).min(0, "Must be ≥ 0"),
    selling_price: z.number({ error: "Selling price is required" }).min(0, "Must be ≥ 0"),
    stock_qty: z.number({ error: "Stock quantity is required" }).int().min(0, "Must be ≥ 0"),
    low_stock_threshold: z.number().int().min(0, "Must be ≥ 0"),
  })
  .refine((data) => data.selling_price >= data.cost_price, {
    message: "Selling price should be ≥ cost price",
    path: ["selling_price"],
  });

export type VariantFormData = z.infer<typeof variantSchema>;
