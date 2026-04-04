import { create } from "zustand";
import type { Payment } from "@/types/payment";

interface PaymentState {
  payments: Payment[];
  loading: boolean;
  search: string;
  dateFrom: string;
  dateTo: string;
  setPayments: (payments: Payment[]) => void;
  setLoading: (loading: boolean) => void;
  setSearch: (search: string) => void;
  setDateFrom: (date: string) => void;
  setDateTo: (date: string) => void;
  filteredPayments: () => Payment[];
  totalShown: () => number;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  loading: false,
  search: "",
  dateFrom: "",
  dateTo: "",
  setPayments: (payments) => set({ payments }),
  setLoading: (loading) => set({ loading }),
  setSearch: (search) => set({ search }),
  setDateFrom: (dateFrom) => set({ dateFrom }),
  setDateTo: (dateTo) => set({ dateTo }),
  filteredPayments: () => {
    const { payments, search } = get();
    if (!search) return payments;
    const q = search.toLowerCase();
    return payments.filter(
      (p) =>
        p.customer_name.toLowerCase().includes(q) ||
        p.product_summary.toLowerCase().includes(q)
    );
  },
  totalShown: () => {
    return get()
      .filteredPayments()
      .reduce((sum, p) => sum + p.amount, 0);
  },
}));
