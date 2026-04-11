export interface SerialNumber {
  id: number;
  variant_id: number;
  serial_no: string;
  status: 'in_stock' | 'sold';
  sale_item_id: number | null;
  added_at: string;
  sold_at: string | null;
  notes: string | null;
}
