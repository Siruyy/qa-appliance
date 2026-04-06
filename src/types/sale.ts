import type { AccountStatus } from "./account";

export type PaymentType = "cash" | "installment";
export type SaleStatus = "completed" | "voided";
export type DiscountType = "peso" | "percent";

export interface Sale {
  id: number;
  customer_id: number | null;
  sale_date: string;
  subtotal: number;
  discount: number;
  discount_type: DiscountType;
  discount_value: number;
  total: number;
  payment_type: PaymentType;
  status: SaleStatus;
  notes: string | null;
  created_at: string;
  customer_name?: string;
  items?: SaleItem[];
}

export interface SaleItem {
  id: number;
  sale_id: number;
  variant_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  cost_price_snapshot?: number;
  item_discount: number;
  item_discount_type: DiscountType;
  item_discount_value: number;
  created_at: string;
  product_name?: string;
  variant_label?: string;
}

export interface CreateSalePayload {
  customer_id: number | null;
  payment_type: PaymentType;
  discount: number;
  discount_type?: DiscountType;
  discount_value?: number;
  notes: string | null;
  items: CreateSaleItemPayload[];
  installment?: CreateInstallmentPayload;
}

export interface CreateSaleItemPayload {
  variant_id: number;
  quantity: number;
  unit_price: number;
  item_discount_type?: DiscountType;
  item_discount_value?: number;
}

export interface CreateInstallmentPayload {
  down_payment: number;
  interest_rate: number;
  penalty_rate: number;
  term_months: number | null;
  start_date: string | null;
  rebate_rate?: number;
}

/** Cart item used in the New Sale page (display + data) */
export interface CartItem {
  variant_id: number;
  product_name: string;
  variant_label: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  stock_qty: number;
  item_discount_type: DiscountType;
  item_discount_value: number;
  item_discount: number;
}

export interface SaleDetail {
  sale: Sale;
  items: SaleItem[];
  account: InstallmentAccountSummary | null;
}

export interface InstallmentAccountSummary {
  id: number;
  principal: number;
  down_payment: number;
  interest_rate: number;
  balance_remaining: number;
  term_months: number | null;
  monthly_amount: number | null;
  status: AccountStatus;
}
