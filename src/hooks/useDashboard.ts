import { invoke } from "@tauri-apps/api/core";
import type { DashboardData } from "@/types/report";
import { useSettingsStore } from "@/stores/settingsStore";

export function useDashboard() {
  const lowStockThreshold = useSettingsStore(
    (s) => parseInt(s.settings.low_stock_threshold, 10) || 5
  );

  const fetchDashboard = async (): Promise<DashboardData> => {
    return invoke<DashboardData>("get_dashboard_data", {
      lowStockThreshold,
    });
  };

  return { fetchDashboard };
}
