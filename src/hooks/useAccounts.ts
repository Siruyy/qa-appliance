import { invoke } from "@tauri-apps/api/core";
import { useAccountStore } from "@/stores/accountStore";
import type { AccountDetail, InstallmentAccount, PenaltyApplied } from "@/types/account";

export function useAccounts() {
  const store = useAccountStore();

  const fetchAccounts = async (
    statusFilter?: string,
    accountType?: string,
    search?: string
  ) => {
    store.setLoading(true);
    try {
      const accounts = await invoke<InstallmentAccount[]>("get_accounts", {
        statusFilter: statusFilter === "all" ? null : statusFilter,
        accountType: accountType === "all" ? null : accountType,
        search: search || null,
      });
      store.setAccounts(accounts);
      return accounts;
    } finally {
      store.setLoading(false);
    }
  };

  const getAccountById = async (id: number): Promise<AccountDetail> => {
    return invoke<AccountDetail>("get_account_by_id", { id });
  };

  const getOverdueAccounts = async (): Promise<InstallmentAccount[]> => {
    return invoke<InstallmentAccount[]>("get_overdue_accounts");
  };

  const markAccountPaid = async (id: number): Promise<void> => {
    await invoke<void>("mark_account_paid", { id });
  };

  const markAccountDefaulted = async (id: number): Promise<void> => {
    await invoke<void>("mark_account_defaulted", { id });
  };

  const updateAccountNotes = async (id: number, notes: string): Promise<void> => {
    await invoke<void>("update_account_notes", { id, notes });
  };

  const runPenaltyCheck = async (): Promise<PenaltyApplied[]> => {
    return invoke<PenaltyApplied[]>("run_penalty_check");
  };

  const recalculateBalance = async (accountId: number): Promise<number> => {
    return invoke<number>("recalculate_balance", { accountId });
  };

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
