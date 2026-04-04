import { create } from "zustand";
import type { InstallmentAccount } from "@/types/account";

interface AccountState {
  accounts: InstallmentAccount[];
  loading: boolean;
  setAccounts: (accounts: InstallmentAccount[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  loading: false,
  setAccounts: (accounts) => set({ accounts }),
  setLoading: (loading) => set({ loading }),
}));
