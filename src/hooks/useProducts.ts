import { extractErrorMessage } from "@/lib/error";
import { useCallback, useEffect } from "react";
import { invoke } from "@/lib/invoke";
import { useProductStore } from "@/stores/productStore";
import { toast } from "sonner";
import type {
  Product,
  CreateProductPayload,
  UpdateProductPayload,
  CreateVariantPayload,
  UpdateVariantPayload,
  ProductVariant,
} from "@/types/product";
import type { PaginatedResult } from "@/types/shared";

export function useProducts() {
  const { setProducts, setLoading } = useProductStore();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await invoke<PaginatedResult<Product>>("get_products", {
        limit: null,
        offset: null,
      });
      setProducts(items);
    } catch (e) {
      toast.error(`Failed to load products: ${extractErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }, [setProducts, setLoading]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const createProduct = async (payload: CreateProductPayload) => {
    const product = await invoke<Product>("create_product", { payload });
    await fetchProducts();
    return product;
  };

  const updateProduct = async (payload: UpdateProductPayload) => {
    const product = await invoke<Product>("update_product", { payload });
    await fetchProducts();
    return product;
  };

  const archiveProduct = async (id: number) => {
    await invoke<void>("archive_product", { id });
    await fetchProducts();
  };

  const restoreProduct = async (id: number) => {
    await invoke<void>("restore_product", { id });
    await fetchProducts();
  };

  const createVariant = async (payload: CreateVariantPayload) => {
    const variant = await invoke<ProductVariant>("create_variant", { payload });
    await fetchProducts();
    return variant;
  };

  const updateVariant = async (payload: UpdateVariantPayload) => {
    const variant = await invoke<ProductVariant>("update_variant", { payload });
    await fetchProducts();
    return variant;
  };

  const archiveVariant = async (id: number) => {
    await invoke<void>("archive_variant", { id });
    await fetchProducts();
  };

  const adjustStock = async (id: number, delta: number) => {
    const variant = await invoke<ProductVariant>("adjust_stock", { id, delta });
    await fetchProducts();
    return variant;
  };

  return {
    fetchProducts,
    createProduct,
    updateProduct,
    archiveProduct,
    restoreProduct,
    createVariant,
    updateVariant,
    archiveVariant,
    adjustStock,
  };
}
