export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerPayload {
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}
