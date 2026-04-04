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
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  setLoading: (loading: boolean) => void;
  setFilter: <K extends keyof ProductFilters>(key: K, value: ProductFilters[K]) => void;
  resetFilters: () => void;
  filteredProducts: () => Product[];
}

const defaultFilters: ProductFilters = {
  search: "",
  categoryId: null,
  status: "active",
};

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  categories: [],
  loading: false,
  filters: { ...defaultFilters },
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  setLoading: (loading) => set({ loading }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
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
