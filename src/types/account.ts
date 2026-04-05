import type { PaymentRecordType } from "./payment";

export type AccountStatus = "open" | "paid" | "defaulted";

export interface PaymentScheduleEntry {
  id: number;
  account_id: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: "pending" | "paid" | "overdue" | "partial";
}

export interface InstallmentAccount {
  id: number;
  sale_id: number;
  customer_id: number;
  customer_name: string;
  product_summary: string;
  principal: number;
  down_payment: number;
  interest_rate: number;
  penalty_rate: number;
  balance_remaining: number;
  has_schedule: boolean;
  term_months: number | null;
  monthly_amount: number | null;
  start_date: string | null;
  status: AccountStatus;
  last_penalty_date: string | null;
  next_due_date: string | null;
  is_overdue: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountDetail extends InstallmentAccount {
  schedule: PaymentScheduleEntry[];
  payments: AccountPayment[];
}

export interface AccountPayment {
  id: number;
  amount: number;
  payment_date: string;
  type: PaymentRecordType;
  notes: string | null;
}

export interface PenaltyApplied {
  account_id: number;
  customer_name: string;
  product_summary: string;
  penalty_amount: number;
}

export interface CreateAccountPayload {
  sale_id: number;
  customer_id: number;
  principal: number;
  down_payment?: number;
  interest_rate: number;
  penalty_rate: number;
  has_schedule: boolean;
  term_months?: number;
  start_date?: string;
}
