import { create } from "zustand";
import type { AppSettings } from "@/types/settings";

const defaultSettings: AppSettings = {
  default_interest_rate: "5",
  default_penalty_rate: "2",
  default_term_months: "12",
  default_down_payment_pct: "20",
  low_stock_threshold: "2",
  store_name: "Quality Appliance",
  store_address: "",
  store_phone: "",
  currency_symbol: "₱",
  preset_terms: "3,6,12,18,24",
};

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  setSettings: (settings: AppSettings) => void;
  setLoading: (loading: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,
  loading: false,
  setSettings: (settings) => set({ settings }),
  setLoading: (loading) => set({ loading }),
}));
