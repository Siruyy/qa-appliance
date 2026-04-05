import { useCallback } from "react";
import { invoke } from "@/lib/invoke";
import type {
  SalesSummaryReport,
  ReceivablesReport,
  InventoryReport,
  CollectionsReport,
  CustomerHistoryReport,
  ProfitLossReport,
} from "@/types/report";

export function useReports() {
  const getSalesSummary = useCallback(async (
    fromDate: string,
    toDate: string
  ): Promise<SalesSummaryReport> => {
    return invoke<SalesSummaryReport>("get_sales_summary", {
      fromDate,
      toDate,
    });
  }, []);

  const getReceivablesReport = useCallback(async (
    statusFilter?: string
  ): Promise<ReceivablesReport> => {
    return invoke<ReceivablesReport>("get_receivables_report", {
      statusFilter: statusFilter ?? null,
    });
  }, []);

  const getInventoryValuationReport = useCallback(async (
    categoryId?: number
  ): Promise<InventoryReport> => {
    return invoke<InventoryReport>("get_inventory_valuation_report", {
      categoryId: categoryId ?? null,
    });
  }, []);

  const getCollectionsReport = useCallback(async (
    fromDate: string,
    toDate: string,
    customerId?: number
  ): Promise<CollectionsReport> => {
    return invoke<CollectionsReport>("get_collections_report", {
      fromDate,
      toDate,
      customerId: customerId ?? null,
    });
  }, []);

  const getCustomerHistoryReport = useCallback(async (
    customerId: number,
    fromDate?: string,
    toDate?: string
  ): Promise<CustomerHistoryReport> => {
    return invoke<CustomerHistoryReport>("get_customer_history_report", {
      customerId,
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
    });
  }, []);

  const getProfitLossReport = useCallback(async (
    fromDate: string,
    toDate: string
  ): Promise<ProfitLossReport> => {
    return invoke<ProfitLossReport>("get_profit_loss_report", {
      fromDate,
      toDate,
    });
  }, []);

  return {
    getSalesSummary,
    getReceivablesReport,
    getInventoryValuationReport,
    getCollectionsReport,
    getCustomerHistoryReport,
    getProfitLossReport,
  };
}
