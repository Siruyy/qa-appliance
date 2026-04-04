import { z } from "zod";

export const recordPaymentSchema = z.object({
  account_id: z.number().int().positive("Account is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  payment_date: z
    .string()
    .min(1, "Payment date is required")
    .refine(
      (val) => {
        const date = new Date(val);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return date <= today;
      },
      { message: "Payment date cannot be in the future" }
    ),
  schedule_id: z.number().int().positive().nullable(),
  notes: z
    .string()
    .max(500, "Notes must be 500 characters or less")
    .nullable(),
});

export type RecordPaymentValues = z.infer<typeof recordPaymentSchema>;
