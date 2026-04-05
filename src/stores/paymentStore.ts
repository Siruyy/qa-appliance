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
    const { payments, search, dateFrom, dateTo } = get();
    return payments.filter((p) => {
      if (dateFrom && p.payment_date < dateFrom) return false;
      if (dateTo && p.payment_date > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.customer_name.toLowerCase().includes(q) &&
          !p.product_summary.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  },
  totalShown: () => {
    return get()
      .filteredPayments()
      .reduce((sum, p) => sum + p.amount, 0);
  },
}));
