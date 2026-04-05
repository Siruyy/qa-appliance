import { useCallback, useEffect } from "react";
import { invoke } from "@/lib/invoke";
import { toast } from "sonner";
import { extractErrorMessage, getErrorWithRecovery } from "@/lib/error";
import type { Sale, SaleDetail, CreateSalePayload } from "@/types/sale";
import type { PaginatedResult } from "@/types/shared";
import { useSaleStore } from "@/stores/saleStore";

/** Hook for sales CRUD with auto-fetch on filter and page changes. */
export function useSales() {
  const { setSales, setLoading, setTotalCount, filters, page, pageSize } =
    useSaleStore();

  /** Fetch paginated sales based on current store filters. */
  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<PaginatedResult<Sale>>("get_sales", {
        search: filters.search || null,
        paymentType: filters.paymentType === "all" ? null : filters.paymentType,
        dateFrom: filters.dateFrom || null,
        dateTo: filters.dateTo || null,
        includeVoided: filters.includeVoided,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setSales(result.items);
      setTotalCount(result.total);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.paymentType,
    filters.dateFrom,
    filters.dateTo,
    filters.includeVoided,
    page,
    pageSize,
    setSales,
    setLoading,
    setTotalCount,
  ]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  /** Fetch full sale details by ID. @returns sale detail or null on error */
  const getSaleById = useCallback(async (id: number): Promise<SaleDetail | null> => {
    try {
      return await invoke<SaleDetail>("get_sale_by_id", { id });
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return null;
    }
  }, []);

  /** Create a new sale, show a toast, and refresh the list. @returns new sale ID or null on error */
  const createSale = useCallback(async (payload: CreateSalePayload): Promise<number | null> => {
    try {
      const id = await invoke<number>("create_sale", { payload });
      toast.success("Sale completed!");
      await fetchSales();
      return id;
    } catch (err) {
      toast.error(getErrorWithRecovery(err, "Failed to create sale"));
      return null;
    }
  }, [fetchSales]);

  /** Void a sale and refresh the list. @returns true on success */
  const voidSale = useCallback(async (id: number): Promise<boolean> => {
    try {
      await invoke("void_sale", { id });
      toast.success("Sale voided");
      await fetchSales();
      return true;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return false;
    }
  }, [fetchSales]);

  return { fetchSales, getSaleById, createSale, voidSale };
}
