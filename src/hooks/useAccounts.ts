import { useCallback } from "react";
import { invoke } from "@/lib/invoke";
import { useAccountStore } from "@/stores/accountStore";
import type { AccountDetail, InstallmentAccount, PenaltyApplied } from "@/types/account";
import type { PaginatedResult } from "@/types/shared";

export function useAccounts() {
  const store = useAccountStore();

  const fetchAccounts = useCallback(async (
    statusFilter?: string,
    accountType?: string,
    search?: string
  ) => {
    store.setLoading(true);
    try {
      const result = await invoke<PaginatedResult<InstallmentAccount>>(
        "get_accounts",
        {
          statusFilter: statusFilter === "all" ? null : (statusFilter ?? null),
          accountType: accountType === "all" ? null : (accountType ?? null),
          search: search || null,
          limit: store.pageSize,
          offset: (store.page - 1) * store.pageSize,
        }
      );
      store.setAccounts(result.items);
      store.setTotalCount(result.total);
      return result.items;
    } finally {
      store.setLoading(false);
    }
  }, [store.page, store.pageSize]);

  const getAccountById = useCallback(async (id: number): Promise<AccountDetail> => {
    return invoke<AccountDetail>("get_account_by_id", { id });
  }, []);

  const getOverdueAccounts = useCallback(async (): Promise<InstallmentAccount[]> => {
    return invoke<InstallmentAccount[]>("get_overdue_accounts");
  }, []);

  const markAccountPaid = useCallback(async (id: number): Promise<void> => {
    await invoke<void>("mark_account_paid", { id });
  }, []);

  const markAccountDefaulted = useCallback(async (id: number): Promise<void> => {
    await invoke<void>("mark_account_defaulted", { id });
  }, []);

  const updateAccountNotes = useCallback(async (id: number, notes: string): Promise<void> => {
    await invoke<void>("update_account_notes", { id, notes });
  }, []);

  const runPenaltyCheck = useCallback(async (): Promise<PenaltyApplied[]> => {
    return invoke<PenaltyApplied[]>("run_penalty_check");
  }, []);

  const recalculateBalance = useCallback(async (accountId: number): Promise<number> => {
    return invoke<number>("recalculate_balance", { accountId });
  }, []);

  return {
    fetchAccounts,
    getAccountById,
    getOverdueAccounts,
    markAccountPaid,
    markAccountDefaulted,
    updateAccountNotes,
    runPenaltyCheck,
    recalculateBalance,
  };
}
