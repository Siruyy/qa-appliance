export interface StockMovement {
  id: number;
  variant_id: number;
  product_name: string;
  variant_label: string | null;
  delta: number;
  reason: string;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  created_at: string;
}
