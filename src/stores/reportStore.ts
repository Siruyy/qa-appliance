import { create } from "zustand";

export type ReportTab =
  | "sales"
  | "receivables"
  | "inventory"
  | "collections"
  | "customer-history"
  | "profit-loss";

interface ReportState {
  activeTab: ReportTab;
  dateFrom: string;
  dateTo: string;
  selectedCustomerId: number | null;
  statusFilter: string;
  categoryId: number | null;
  setActiveTab: (tab: ReportTab) => void;
  setDateFrom: (d: string) => void;
  setDateTo: (d: string) => void;
  setSelectedCustomerId: (id: number | null) => void;
  setStatusFilter: (s: string) => void;
  setCategoryId: (id: number | null) => void;
}

function defaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: from.toISOString().split("T")[0],
    dateTo: now.toISOString().split("T")[0],
  };
}

export const useReportStore = create<ReportState>((set, get) => ({
  activeTab: "sales",
  ...defaultDateRange(),
  selectedCustomerId: null,
  statusFilter: "all",
  categoryId: null,
  setActiveTab: (activeTab) => set({ activeTab }),
  setDateFrom: (dateFrom) => {
    const { dateTo } = get();
    if (dateTo && dateFrom > dateTo) return;
    set({ dateFrom });
  },
  setDateTo: (dateTo) => {
    const { dateFrom } = get();
    if (dateFrom && dateTo < dateFrom) return;
    set({ dateTo });
  },
  setSelectedCustomerId: (selectedCustomerId) => set({ selectedCustomerId }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setCategoryId: (categoryId) => set({ categoryId }),
}));
