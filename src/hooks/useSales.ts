import { useCallback, useEffect } from "react";
import { invoke } from "@/lib/invoke";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/error";
import type { Sale, SaleDetail, CreateSalePayload } from "@/types/sale";
import type { PaginatedResult } from "@/types/shared";
import { useSaleStore } from "@/stores/saleStore";

export function useSales() {
  const { setSales, setLoading, setTotalCount, filters, page, pageSize } =
    useSaleStore();

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

  const getSaleById = useCallback(async (id: number): Promise<SaleDetail | null> => {
    try {
      return await invoke<SaleDetail>("get_sale_by_id", { id });
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return null;
    }
  }, []);

  const createSale = useCallback(async (payload: CreateSalePayload): Promise<number | null> => {
    try {
      const id = await invoke<number>("create_sale", { payload });
      toast.success("Sale completed!");
      await fetchSales();
      return id;
    } catch (err) {
      toast.error(extractErrorMessage(err));
      return null;
    }
  }, [fetchSales]);

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
