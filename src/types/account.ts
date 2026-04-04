export type AccountStatus = "open" | "paid" | "defaulted";

export interface InstallmentAccount {
  id: number;
  sale_id: number;
  customer_id: number;
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
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
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
