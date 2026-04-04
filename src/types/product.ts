export interface Category {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category_name?: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string | null;
  attributes: Record<string, string> | null;
  cost_price: number;
  selling_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_name?: string;
}

export interface CreateProductPayload {
  name: string;
  category_id: number;
  description?: string;
}

export interface UpdateProductPayload {
  id: number;
  name?: string;
  category_id?: number;
  description?: string;
}

export interface CreateVariantPayload {
  product_id: number;
  sku?: string;
  attributes?: Record<string, string>;
  cost_price: number;
  selling_price: number;
  stock_qty: number;
  low_stock_threshold?: number;
}

export interface UpdateVariantPayload {
  id: number;
  sku?: string;
  attributes?: Record<string, string>;
  cost_price?: number;
  selling_price?: number;
  stock_qty?: number;
  low_stock_threshold?: number;
}
