import { create } from "zustand";
import type { Customer } from "@/types/customer";

interface CustomerFilters {
  search: string;
  status: "all" | "active" | "archived";
}

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  filters: CustomerFilters;
  page: number;
  pageSize: number;
  totalCount: number;
  setCustomers: (customers: Customer[]) => void;
  setLoading: (loading: boolean) => void;
  setFilter: <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setTotalCount: (totalCount: number) => void;
  filteredCustomers: () => Customer[];
}

const defaultFilters: CustomerFilters = {
  search: "",
  status: "active",
};

/** Zustand store for customer list state, filters, and pagination. */
export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  loading: false,
  filters: { ...defaultFilters },
  page: 1,
  pageSize: 50,
  totalCount: 0,
  setCustomers: (customers) => set({ customers }),
  setLoading: (loading) => set({ loading }),
  /** Update a single filter field and reset to page 1. */
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value }, page: 1 })),
  /** Reset all filters to defaults and go to page 1. */
  resetFilters: () => set({ filters: { ...defaultFilters }, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  setTotalCount: (totalCount) => set({ totalCount }),
  /** Derive a client-side filtered customer list from the current state. */
  filteredCustomers: () => {
    const { customers, filters } = get();
    return customers.filter((c) => {
      if (filters.status === "active" && !c.is_active) return false;
      if (filters.status === "archived" && c.is_active) return false;

      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q);
        const matchesAddress = c.address?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesAddress) return false;
      }

      return true;
    });
  },
}));
