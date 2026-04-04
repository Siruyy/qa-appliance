import { create } from "zustand";
import type { Payment } from "@/types/payment";

interface PaymentState {
  payments: Payment[];
  loading: boolean;
  search: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
  totalCount: number;
  setPayments: (payments: Payment[]) => void;
  setLoading: (loading: boolean) => void;
  setSearch: (search: string) => void;
  setDateFrom: (date: string) => void;
  setDateTo: (date: string) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setTotalCount: (totalCount: number) => void;
  filteredPayments: () => Payment[];
  totalShown: () => number;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  loading: false,
  search: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: 50,
  totalCount: 0,
  setPayments: (payments) => set({ payments }),
  setLoading: (loading) => set({ loading }),
  setSearch: (search) => set({ search, page: 1 }),
  setDateFrom: (dateFrom) => set({ dateFrom, page: 1 }),
  setDateTo: (dateTo) => set({ dateTo, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  setTotalCount: (totalCount) => set({ totalCount }),
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
