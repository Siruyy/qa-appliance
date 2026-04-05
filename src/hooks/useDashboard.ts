import { useCallback } from "react";
import { invoke } from "@/lib/invoke";
import type { DashboardData } from "@/types/report";
import { useSettingsStore } from "@/stores/settingsStore";
import { parseSettings } from "@/types/settings";

/** Hook providing dashboard data fetcher using current app settings. */
export function useDashboard() {
  const lowStockThreshold = useSettingsStore(
    (s) => parseSettings(s.settings).low_stock_threshold
  );

  /** Fetch dashboard summary data for the given chart period (defaults to 30 days). */
  const fetchDashboard = useCallback((chartDays?: number): Promise<DashboardData> => {
    return invoke<DashboardData>("get_dashboard_data", {
      lowStockThreshold,
      chartDays: chartDays ?? 30,
    });
  }, [lowStockThreshold]);

  return { fetchDashboard };
}
