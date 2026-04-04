export type PaymentType = "cash" | "installment";
export type SaleStatus = "completed" | "voided";

export interface Sale {
  id: number;
  customer_id: number | null;
  sale_date: string;
  subtotal: number;
  discount: number;
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
  created_at: string;
  product_name?: string;
  variant_label?: string;
}

export interface CreateSalePayload {
  customer_id?: number;
  payment_type: PaymentType;
  discount?: number;
  notes?: string;
  items: CreateSaleItemPayload[];
}

export interface CreateSaleItemPayload {
  variant_id: number;
  quantity: number;
  unit_price: number;
}
