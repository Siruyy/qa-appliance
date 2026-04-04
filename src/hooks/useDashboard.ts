import { useCallback } from "react";
import { invoke } from "@/lib/invoke";
import type { DashboardData } from "@/types/report";
import { useSettingsStore } from "@/stores/settingsStore";

export function useDashboard() {
  const lowStockThreshold = useSettingsStore(
    (s) => parseInt(s.settings.low_stock_threshold, 10) || 5
  );

  const fetchDashboard = useCallback((): Promise<DashboardData> => {
    return invoke<DashboardData>("get_dashboard_data", {
      lowStockThreshold,
    });
  }, [lowStockThreshold]);

  return { fetchDashboard };
}
