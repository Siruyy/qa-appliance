import { z } from "zod";

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required")
    .max(200, "Max 200 characters"),
  phone: z
    .string()
    .trim()
    .max(20, "Max 20 characters")
    .regex(/^[0-9+\-\s]*$/, "Only numbers, +, -, and spaces allowed")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .max(500, "Max 500 characters")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(500, "Max 500 characters")
    .optional()
    .or(z.literal("")),
  credit_limit: z
    .string()
    .optional()
    .or(z.literal("")),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

/** Parse credit_limit string to number | null for submission */
export function parseCreditLimit(value?: string): number | null {
  if (!value || value.trim() === "") return null;
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return null;
  return n;
}
