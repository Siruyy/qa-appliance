import { create } from "zustand";
import type { Sale, SaleItem } from "@/types/sale";

interface SaleState {
  sales: Sale[];
  currentItems: SaleItem[];
  loading: boolean;
  setSales: (sales: Sale[]) => void;
  setCurrentItems: (items: SaleItem[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useSaleStore = create<SaleState>((set) => ({
  sales: [],
  currentItems: [],
  loading: false,
  setSales: (sales) => set({ sales }),
  setCurrentItems: (currentItems) => set({ currentItems }),
  setLoading: (loading) => set({ loading }),
}));
