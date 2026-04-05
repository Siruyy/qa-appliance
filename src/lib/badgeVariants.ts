/**
 * Centralized status → Badge variant mappings (CQ-01 / CQ-02).
 * Import from here instead of defining inline maps in each page.
 */

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

/** Account status (open, paid, defaulted) */
export const accountStatusVariant: Record<string, BadgeVariant> = {
  open: "default",
  paid: "secondary",
  defaulted: "destructive",
};

/** Payment schedule entry status (paid, partial, pending, overdue) */
export const scheduleStatusVariant: Record<string, BadgeVariant> = {
  paid: "default",
  partial: "secondary",
  pending: "outline",
  overdue: "destructive",
};

/** Sale status (completed, voided) */
export const saleStatusVariant: Record<string, BadgeVariant> = {
  completed: "default",
  voided: "destructive",
};

/** Payment type (cash, installment) */
export const paymentTypeVariant: Record<string, BadgeVariant> = {
  cash: "default",
  installment: "secondary",
};

/** Collection payment type (regular, penalty, advance) */
export const collectionTypeVariant: Record<string, BadgeVariant> = {
  regular: "default",
  penalty: "secondary",
  advance: "secondary",
};

/** Inventory stock status */
export const stockStatusVariant: Record<string, BadgeVariant> = {
  in_stock: "default",
  low_stock: "secondary",
  out_of_stock: "destructive",
};
