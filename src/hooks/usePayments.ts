import { useCallback } from "react";
import { invoke } from "@/lib/invoke";
import { usePaymentStore } from "@/stores/paymentStore";
import type { Payment, RecordPaymentPayload } from "@/types/payment";
import type { PaginatedResult } from "@/types/shared";

export function usePayments() {
  const store = usePaymentStore();

  const fetchPayments = useCallback(async (
    fromDate?: string,
    toDate?: string,
    customerId?: number,
    search?: string
  ) => {
    store.setLoading(true);
    try {
      const result = await invoke<PaginatedResult<Payment>>("get_payments", {
        fromDate: fromDate || null,
        toDate: toDate || null,
        customerId: customerId ?? null,
        search: search || null,
        limit: store.pageSize,
        offset: (store.page - 1) * store.pageSize,
      });
      store.setPayments(result.items);
      store.setTotalCount(result.total);
      return result.items;
    } finally {
      store.setLoading(false);
    }
  }, [store.page, store.pageSize]);

  const getPaymentsForAccount = useCallback(async (accountId: number): Promise<Payment[]> => {
    return invoke<Payment[]>("get_payments_for_account", { accountId });
  }, []);

  const recordPayment = useCallback(async (payload: RecordPaymentPayload): Promise<Payment> => {
    return invoke<Payment>("record_payment", { payload });
  }, []);

  return {
    fetchPayments,
    getPaymentsForAccount,
    recordPayment,
  };
}
