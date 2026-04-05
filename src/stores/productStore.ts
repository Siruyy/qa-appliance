import { create } from "zustand";
import type { Product, Category } from "@/types/product";

interface ProductFilters {
  search: string;
  categoryId: number | null;
  status: "all" | "active" | "archived";
}

interface ProductState {
  products: Product[];
  categories: Category[];
  loading: boolean;
  filters: ProductFilters;
  page: number;
  pageSize: number;
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  setLoading: (loading: boolean) => void;
  setFilter: <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  filteredProducts: () => Product[];
}

const defaultFilters: ProductFilters = {
  search: "",
  categoryId: null,
  status: "active",
};

/** Zustand store for product list state, filters, and pagination. */
export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  categories: [],
  loading: false,
  filters: { ...defaultFilters },
  page: 1,
  pageSize: 50,
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  setLoading: (loading) => set({ loading }),
  /** Update a single filter field and reset to page 1. */
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value }, page: 1 })),
  /** Reset all filters to defaults and go to page 1. */
  resetFilters: () => set({ filters: { ...defaultFilters }, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  /** Derive a client-side filtered product list from the current state. */
  filteredProducts: () => {
    const { products, filters } = get();
    return products.filter((p) => {
      // Status filter
      if (filters.status === "active" && !p.is_active) return false;
      if (filters.status === "archived" && p.is_active) return false;

      // Category filter
      if (filters.categoryId !== null && p.category_id !== filters.categoryId) return false;

      // Search filter (name or category name)
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCategory = p.category_name?.toLowerCase().includes(q);
        const matchesSku = p.variants?.some((v) => v.sku?.toLowerCase().includes(q));
        if (!matchesName && !matchesCategory && !matchesSku) return false;
      }

      return true;
    });
  },
}));
