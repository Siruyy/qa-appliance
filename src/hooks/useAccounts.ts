import { useCallback } from "react";
import { invoke } from "@/lib/invoke";
import { useAccountStore } from "@/stores/accountStore";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/error";
import type { AccountDetail, InstallmentAccount, PenaltyApplied } from "@/types/account";
import type { PaginatedResult } from "@/types/shared";

/** Hook for managing installment accounts with pagination and filtering. */
export function useAccounts() {
  const store = useAccountStore();

  /** Fetch paginated accounts with optional status, type, and search filters. */
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
    } catch (e) {
      toast.error(`Failed to load accounts: ${extractErrorMessage(e)}`);
      return [];
    } finally {
      store.setLoading(false);
    }
  }, [store.page, store.pageSize]);

  /** Fetch a single account's full details by ID. */
  const getAccountById = useCallback(async (id: number): Promise<AccountDetail> => {
    return invoke<AccountDetail>("get_account_by_id", { id });
  }, []);

  /** Fetch all accounts that are currently past due. */
  const getOverdueAccounts = useCallback(async (): Promise<InstallmentAccount[]> => {
    return invoke<InstallmentAccount[]>("get_overdue_accounts");
  }, []);

  /** Mark an account as fully paid. */
  const markAccountPaid = useCallback(async (id: number): Promise<void> => {
    await invoke<void>("mark_account_paid", { id });
  }, []);

  /** Mark an account as defaulted. */
  const markAccountDefaulted = useCallback(async (id: number): Promise<void> => {
    await invoke<void>("mark_account_defaulted", { id });
  }, []);

  /** Update the notes field on an account. */
  const updateAccountNotes = useCallback(async (id: number, notes: string): Promise<void> => {
    await invoke<void>("update_account_notes", { id, notes });
  }, []);

  /** Run penalty check on overdue accounts. @returns penalties that were applied */
  const runPenaltyCheck = useCallback(async (): Promise<PenaltyApplied[]> => {
    return invoke<PenaltyApplied[]>("run_penalty_check");
  }, []);

  /** Recalculate and return the remaining balance for an account. */
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
