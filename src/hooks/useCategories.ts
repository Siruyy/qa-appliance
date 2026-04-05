import { extractErrorMessage } from "@/lib/error";
import { useCallback, useEffect } from "react";
import { invoke } from "@/lib/invoke";
import { useProductStore } from "@/stores/productStore";
import type { Category } from "@/types/product";
import { toast } from "sonner";

export function useCategories() {
  const { setCategories } = useProductStore();

  const fetchCategories = useCallback(async () => {
    try {
      const data = await invoke<Category[]>("get_categories");
      setCategories(data);
    } catch (e) {
      toast.error(`Failed to load categories: ${extractErrorMessage(e)}`);
    }
  }, [setCategories]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = async (name: string, description?: string) => {
    const category = await invoke<Category>("create_category", { name, description });
    await fetchCategories();
    return category;
  };

  const updateCategory = async (id: number, name: string, description?: string) => {
    const category = await invoke<Category>("update_category", { id, name, description });
    await fetchCategories();
    return category;
  };

  const deleteCategory = async (id: number) => {
    await invoke<void>("delete_category", { id });
    await fetchCategories();
  };

  return {
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
