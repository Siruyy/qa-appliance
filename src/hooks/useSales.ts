import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { Sale, SaleDetail, CreateSalePayload } from "@/types/sale";
import { useSaleStore } from "@/stores/saleStore";

export function useSales() {
  const { setSales, setLoading, filters } = useSaleStore();

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const sales = await invoke<Sale[]>("get_sales", {
        search: filters.search || null,
        paymentType: filters.paymentType === "all" ? null : filters.paymentType,
        dateFrom: filters.dateFrom || null,
        dateTo: filters.dateTo || null,
        includeVoided: filters.includeVoided,
      });
      setSales(sales);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.paymentType, filters.dateFrom, filters.dateTo, filters.includeVoided, setSales, setLoading]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const getSaleById = useCallback(async (id: number): Promise<SaleDetail | null> => {
    try {
      return await invoke<SaleDetail>("get_sale_by_id", { id });
    } catch (err) {
      toast.error(String(err));
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
      toast.error(String(err));
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
      toast.error(String(err));
      return false;
    }
  }, [fetchSales]);

  return { fetchSales, getSaleById, createSale, voidSale };
}
