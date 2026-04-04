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
  setCustomers: (customers: Customer[]) => void;
  setLoading: (loading: boolean) => void;
  setFilter: <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) => void;
  resetFilters: () => void;
  filteredCustomers: () => Customer[];
}

const defaultFilters: CustomerFilters = {
  search: "",
  status: "active",
};

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  loading: false,
  filters: { ...defaultFilters },
  setCustomers: (customers) => set({ customers }),
  setLoading: (loading) => set({ loading }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
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
