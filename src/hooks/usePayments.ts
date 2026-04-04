import { invoke } from "@tauri-apps/api/core";
import { usePaymentStore } from "@/stores/paymentStore";
import type { Payment, RecordPaymentPayload } from "@/types/payment";

export function usePayments() {
  const store = usePaymentStore();

  const fetchPayments = async (
    fromDate?: string,
    toDate?: string,
    customerId?: number,
    search?: string
  ) => {
    store.setLoading(true);
    try {
      const payments = await invoke<Payment[]>("get_payments", {
        fromDate: fromDate || null,
        toDate: toDate || null,
        customerId: customerId ?? null,
        search: search || null,
      });
      store.setPayments(payments);
      return payments;
    } finally {
      store.setLoading(false);
    }
  };

  const getPaymentsForAccount = async (accountId: number): Promise<Payment[]> => {
    return invoke<Payment[]>("get_payments_for_account", { accountId });
  };

  const recordPayment = async (payload: RecordPaymentPayload): Promise<Payment> => {
    return invoke<Payment>("record_payment", { payload });
  };

  return {
    fetchPayments,
    getPaymentsForAccount,
    recordPayment,
  };
}
