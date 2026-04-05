import { create } from "zustand";
import type { Sale } from "@/types/sale";

interface SaleFilters {
  search: string;
  paymentType: "all" | "cash" | "installment";
  dateFrom: string;
  dateTo: string;
  includeVoided: boolean;
}

interface SaleListState {
  sales: Sale[];
  loading: boolean;
  filters: SaleFilters;
  page: number;
  pageSize: number;
  totalCount: number;
  setSales: (sales: Sale[]) => void;
  setLoading: (loading: boolean) => void;
  setFilter: <K extends keyof SaleFilters>(key: K, value: SaleFilters[K]) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setTotalCount: (totalCount: number) => void;
  filteredSales: () => Sale[];
}

const defaultFilters: SaleFilters = {
  search: "",
  paymentType: "all",
  dateFrom: "",
  dateTo: "",
  includeVoided: false,
};

/** Zustand store for sales list, filters, and pagination. */
export const useSaleStore = create<SaleListState>((set, get) => ({
  sales: [],
  loading: false,
  filters: { ...defaultFilters },
  page: 1,
  pageSize: 50,
  totalCount: 0,

  setSales: (sales) => set({ sales }),
  setLoading: (loading) => set({ loading }),
  /** Update a single sale filter and reset to page 1. */
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value }, page: 1 })),
  /** Reset all sale filters to defaults and go to page 1. */
  resetFilters: () => set({ filters: { ...defaultFilters }, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  setTotalCount: (totalCount) => set({ totalCount }),

  /** Derive a client-side filtered sales list from current filters. */
  filteredSales: () => {
    const { sales, filters } = get();
    return sales.filter((s) => {
      if (!filters.includeVoided && s.status === "voided") return false;
      if (filters.paymentType !== "all" && s.payment_type !== filters.paymentType) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !s.customer_name?.toLowerCase().includes(q) &&
          !String(s.id).includes(q)
        )
          return false;
      }
      if (filters.dateFrom && s.sale_date < filters.dateFrom) return false;
      if (filters.dateTo && s.sale_date > filters.dateTo) return false;
      return true;
    });
  },
}));

