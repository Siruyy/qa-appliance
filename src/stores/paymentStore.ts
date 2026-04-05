import { create } from "zustand";
import type { Payment, PaymentRecordType } from "@/types/payment";
import { matchesSearch, matchesDateRange } from "@/lib/filterUtils";

interface PaymentState {
  payments: Payment[];
  loading: boolean;
  search: string;
  dateFrom: string;
  dateTo: string;
  typeFilter: PaymentRecordType | "all";
  page: number;
  pageSize: number;
  totalCount: number;
  setPayments: (payments: Payment[]) => void;
  setLoading: (loading: boolean) => void;
  setSearch: (search: string) => void;
  setDateFrom: (date: string) => void;
  setDateTo: (date: string) => void;
  setTypeFilter: (type: PaymentRecordType | "all") => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setTotalCount: (totalCount: number) => void;
  filteredPayments: () => Payment[];
  totalShown: () => number;
}

/** Zustand store for payment list, filters, and pagination. */
export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  loading: false,
  search: "",
  dateFrom: "",
  dateTo: "",
  typeFilter: "all",
  page: 1,
  pageSize: 50,
  totalCount: 0,
  setPayments: (payments) => set({ payments }),
  setLoading: (loading) => set({ loading }),
  /** Update the search term and reset to page 1. */
  setSearch: (search) => set({ search, page: 1 }),
  /** Update the date-from filter and reset to page 1. */
  setDateFrom: (dateFrom) => set({ dateFrom, page: 1 }),
  /** Update the date-to filter and reset to page 1. */
  setDateTo: (dateTo) => set({ dateTo, page: 1 }),
  /** Update the payment type filter and reset to page 1. */
  setTypeFilter: (typeFilter) => set({ typeFilter, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  setTotalCount: (totalCount) => set({ totalCount }),
  /** Derive a client-side filtered payment list from current state. */
  filteredPayments: () => {
    const { payments, search, dateFrom, dateTo, typeFilter } = get();
    return payments.filter((p) => {
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (!matchesDateRange(p.payment_date, dateFrom, dateTo)) return false;
      return matchesSearch(p, ["customer_name", "product_summary"], search);
    });
  },
  /** Sum the amounts of all currently filtered payments. */
  totalShown: () => {
    return get()
      .filteredPayments()
      .reduce((sum, p) => sum + p.amount, 0);
  },
}));
