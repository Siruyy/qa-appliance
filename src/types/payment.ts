export type PaymentRecordType = "payment" | "penalty" | "interest_adjustment" | "down_payment" | "rebate";
export type ScheduleStatus = "pending" | "paid" | "overdue" | "partial";

export interface Payment {
  id: number;
  account_id: number;
  schedule_id: number | null;
  customer_name: string;
  product_summary: string;
  amount: number;
  payment_date: string;
  type: PaymentRecordType;
  notes: string | null;
  created_at: string;
}

export interface PaymentSchedule {
  id: number;
  account_id: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: ScheduleStatus;
  created_at: string;
  updated_at: string;
}

export interface RecordPaymentPayload {
  account_id: number;
  schedule_id: number | null;
  amount: number;
  payment_date: string;
  notes: string | null;
}
