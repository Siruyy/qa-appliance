import { useCallback } from "react";
import { invoke } from "@/lib/invoke";
import { usePaymentStore } from "@/stores/paymentStore";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/error";
import type { Payment, RecordPaymentPayload } from "@/types/payment";
import type { PaginatedResult } from "@/types/shared";

/** Hook for managing payment records with pagination and filtering. */
export function usePayments() {
  const store = usePaymentStore();

  /** Fetch paginated payments with optional date range, customer, and search filters. */
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
    } catch (e) {
      toast.error(`Failed to load payments: ${extractErrorMessage(e)}`);
      return [];
    } finally {
      store.setLoading(false);
    }
  }, [store.page, store.pageSize]);

  /** Get all payments associated with an installment account. */
  const getPaymentsForAccount = useCallback(async (accountId: number): Promise<Payment[]> => {
    return invoke<Payment[]>("get_payments_for_account", { accountId });
  }, []);

  /** Record a new payment and refresh the payments list. */
  const recordPayment = useCallback(async (payload: RecordPaymentPayload): Promise<Payment> => {
    const payment = await invoke<Payment>("record_payment", { payload });
    // Refetch payments list so the store reflects the new payment
    await fetchPayments();
    return payment;
  }, [fetchPayments]);

  return {
    fetchPayments,
    getPaymentsForAccount,
    recordPayment,
  };
}
