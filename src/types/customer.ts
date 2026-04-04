export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  open_accounts_count: number;
  total_balance: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerDetail {
  customer: Customer;
  sales: CustomerSaleSummary[];
  accounts: CustomerAccountSummary[];
  payments: CustomerPaymentSummary[];
}

export interface CustomerSaleSummary {
  id: number;
  sale_date: string;
  total: number;
  payment_type: string;
  status: string;
  items_summary: string;
}

export interface CustomerAccountSummary {
  id: number;
  sale_id: number;
  principal: number;
  balance_remaining: number;
  has_schedule: boolean;
  term_months: number | null;
  monthly_amount: number | null;
  status: string;
  items_summary: string;
}

export interface CustomerPaymentSummary {
  id: number;
  account_id: number;
  amount: number;
  payment_date: string;
  type: string;
  notes: string | null;
}

export interface CreateCustomerPayload {
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerPayload {
  id: number;
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
}
