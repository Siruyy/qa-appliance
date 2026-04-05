import { z } from "zod";

export const saleItemSchema = z.object({
  variant_id: z.number().int().positive(),
  quantity: z.number().int().positive({ error: "Must be at least 1" }),
  unit_price: z.number().positive({ error: "Price must be positive" }),
});

export const installmentSchema = z.object({
  down_payment: z.number().min(0, { error: "Down payment cannot be negative" }),
  interest_rate: z.number().min(0).max(100, { error: "Interest rate must be 0-100%" }),
  penalty_rate: z.number().min(0).max(100, { error: "Penalty rate must be 0-100%" }),
  has_schedule: z.boolean(),
  term_months: z.number().int().min(1).max(60).nullable(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format")
    .nullable(),
});

export const createSaleSchema = z
  .object({
    customer_id: z.number().int().positive().nullable(),
    payment_type: z.enum(["cash", "installment"]),
    discount: z.number().min(0),
    notes: z.string().max(500, "Max 500 characters").nullable(),
    items: z.array(saleItemSchema).min(1, { error: "Add at least one item" }),
    installment: installmentSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.payment_type === "installment") {
        return !!data.customer_id;
      }
      return true;
    },
    { message: "Customer is required for installment sales", path: ["customer_id"] }
  )
  .refine(
    (data) => {
      if (data.payment_type === "installment") {
        return !!data.installment;
      }
      return true;
    },
    { message: "Installment details required", path: ["installment"] }
  );

export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type InstallmentInput = z.infer<typeof installmentSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
