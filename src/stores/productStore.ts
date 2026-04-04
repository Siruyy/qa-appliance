import { create } from "zustand";
import type { Product, Category, ProductVariant } from "@/types/product";

interface ProductState {
  products: Product[];
  categories: Category[];
  variants: ProductVariant[];
  loading: boolean;
  setProducts: (products: Product[]) => void;
  setCategories: (categories: Category[]) => void;
  setVariants: (variants: ProductVariant[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  categories: [],
  variants: [],
  loading: false,
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  setVariants: (variants) => set({ variants }),
  setLoading: (loading) => set({ loading }),
}));
