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

/** Hook for product and variant CRUD operations with auto-fetch on mount. */
export function useProducts() {
  const { setProducts, setTotalCount, setLoading } = useProductStore();

  /** Fetch all products from the backend and update the store. */
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { items, total } = await invoke<PaginatedResult<Product>>("get_products", {
        limit: null,
        offset: null,
      });
      setProducts(items);
      setTotalCount(total);
    } catch (e) {
      toast.error(`Failed to load products: ${extractErrorMessage(e)}`);
    } finally {
      setLoading(false);
    }
  }, [setProducts, setTotalCount, setLoading]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /** Create a new product and refresh the list. */
  const createProduct = useCallback(async (payload: CreateProductPayload) => {
    const product = await invoke<Product>("create_product", { payload });
    await fetchProducts();
    return product;
  }, [fetchProducts]);

  /** Update an existing product and refresh the list. */
  const updateProduct = useCallback(async (payload: UpdateProductPayload) => {
    const product = await invoke<Product>("update_product", { payload });
    await fetchProducts();
    return product;
  }, [fetchProducts]);

  /** Soft-delete a product and refresh the list. */
  const archiveProduct = useCallback(async (id: number) => {
    await invoke<void>("archive_product", { id });
    await fetchProducts();
  }, [fetchProducts]);

  /** Restore an archived product and refresh the list. */
  const restoreProduct = useCallback(async (id: number) => {
    await invoke<void>("restore_product", { id });
    await fetchProducts();
  }, [fetchProducts]);

  /** Create a product variant and refresh the list. */
  const createVariant = useCallback(async (payload: CreateVariantPayload) => {
    const variant = await invoke<ProductVariant>("create_variant", { payload });
    await fetchProducts();
    return variant;
  }, [fetchProducts]);

  /** Update a product variant and refresh the list. */
  const updateVariant = useCallback(async (payload: UpdateVariantPayload) => {
    const variant = await invoke<ProductVariant>("update_variant", { payload });
    await fetchProducts();
    return variant;
  }, [fetchProducts]);

  /** Soft-delete a variant and refresh the list. */
  const archiveVariant = useCallback(async (id: number) => {
    await invoke<void>("archive_variant", { id });
    await fetchProducts();
  }, [fetchProducts]);

  /** Adjust variant stock by a delta amount and refresh the list. */
  const adjustStock = useCallback(async (id: number, delta: number) => {
    const variant = await invoke<ProductVariant>("adjust_stock", { id, delta });
    await fetchProducts();
    return variant;
  }, [fetchProducts]);

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
