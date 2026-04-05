import type { PaymentType, SaleStatus } from "./sale";
import type { AccountStatus } from "./account";
import type { PaymentRecordType } from "./payment";

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
  payment_type: PaymentType;
  status: SaleStatus;
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
  status: AccountStatus;
  items_summary: string;
}

export interface CustomerPaymentSummary {
  id: number;
  account_id: number;
  amount: number;
  payment_date: string;
  type: PaymentRecordType;
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
