import { invoke } from "@tauri-apps/api/core";
import type {
  SalesSummaryReport,
  ReceivablesReport,
  InventoryReport,
  CollectionsReport,
  CustomerHistoryReport,
  ProfitLossReport,
} from "@/types/report";

export function useReports() {
  const getSalesSummary = async (
    fromDate: string,
    toDate: string
  ): Promise<SalesSummaryReport> => {
    return invoke<SalesSummaryReport>("get_sales_summary", {
      fromDate,
      toDate,
    });
  };

  const getReceivablesReport = async (
    statusFilter?: string
  ): Promise<ReceivablesReport> => {
    return invoke<ReceivablesReport>("get_receivables_report", {
      statusFilter: statusFilter ?? null,
    });
  };

  const getInventoryValuationReport = async (
    categoryId?: number
  ): Promise<InventoryReport> => {
    return invoke<InventoryReport>("get_inventory_valuation_report", {
      categoryId: categoryId ?? null,
    });
  };

  const getCollectionsReport = async (
    fromDate: string,
    toDate: string,
    customerId?: number
  ): Promise<CollectionsReport> => {
    return invoke<CollectionsReport>("get_collections_report", {
      fromDate,
      toDate,
      customerId: customerId ?? null,
    });
  };

  const getCustomerHistoryReport = async (
    customerId: number,
    fromDate?: string,
    toDate?: string
  ): Promise<CustomerHistoryReport> => {
    return invoke<CustomerHistoryReport>("get_customer_history_report", {
      customerId,
      fromDate: fromDate ?? null,
      toDate: toDate ?? null,
    });
  };

  const getProfitLossReport = async (
    fromDate: string,
    toDate: string
  ): Promise<ProfitLossReport> => {
    return invoke<ProfitLossReport>("get_profit_loss_report", {
      fromDate,
      toDate,
    });
  };

  return {
    getSalesSummary,
    getReceivablesReport,
    getInventoryValuationReport,
    getCollectionsReport,
    getCustomerHistoryReport,
    getProfitLossReport,
  };
}
