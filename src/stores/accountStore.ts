import { create } from "zustand";
import type { InstallmentAccount } from "@/types/account";

type StatusFilter = "all" | "open" | "overdue" | "paid" | "defaulted";
type TypeFilter = "all" | "installment" | "utang";

interface AccountState {
  accounts: InstallmentAccount[];
  loading: boolean;
  search: string;
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  page: number;
  pageSize: number;
  totalCount: number;
  setAccounts: (accounts: InstallmentAccount[]) => void;
  setLoading: (loading: boolean) => void;
  setSearch: (search: string) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setTypeFilter: (filter: TypeFilter) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setTotalCount: (totalCount: number) => void;
  filteredAccounts: () => InstallmentAccount[];
  overdueCount: () => number;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  loading: false,
  search: "",
  statusFilter: "all",
  typeFilter: "all",
  page: 1,
  pageSize: 50,
  totalCount: 0,
  setAccounts: (accounts) => set({ accounts }),
  setLoading: (loading) => set({ loading }),
  setSearch: (search) => set({ search, page: 1 }),
  setStatusFilter: (statusFilter) => set({ statusFilter, page: 1 }),
  setTypeFilter: (typeFilter) => set({ typeFilter, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  setTotalCount: (totalCount) => set({ totalCount }),
  filteredAccounts: () => {
    const { accounts, search, statusFilter, typeFilter } = get();
    return accounts.filter((a) => {
      if (statusFilter === "overdue" && !a.is_overdue) return false;
      if (statusFilter !== "all" && statusFilter !== "overdue" && a.status !== statusFilter)
        return false;
      if (typeFilter === "installment" && !a.has_schedule) return false;
      if (typeFilter === "utang" && a.has_schedule) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !a.customer_name.toLowerCase().includes(q) &&
          !a.product_summary.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  },
  overdueCount: () => {
    return get().accounts.filter((a) => a.is_overdue && a.status === "open").length;
  },
}));
