import { create } from "zustand";
import type { Customer } from "@/types/customer";

interface CustomerState {
  customers: Customer[];
  loading: boolean;
  setCustomers: (customers: Customer[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: [],
  loading: false,
  setCustomers: (customers) => set({ customers }),
  setLoading: (loading) => set({ loading }),
}));
