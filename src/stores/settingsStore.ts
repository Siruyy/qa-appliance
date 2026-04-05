import { create } from "zustand";
import type { AppSettings } from "@/types/settings";
import { invoke } from "@/lib/invoke";

const defaultSettings: AppSettings = {
  default_interest_rate: "5",
  default_penalty_rate: "2",
  default_term_months: "12",
  default_down_payment_pct: "20",
  low_stock_threshold: "5",
  store_name: "Quality Appliance",
  store_address: "",
  store_phone: "",
  currency_symbol: "₱",
  preset_terms: "3,6,12,18,24",
  receipt_footer: "",
};

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  loadSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
  updateSettingsBatch: (pairs: [string, string][]) => Promise<void>;
}

/** Zustand store for app-wide settings with backend persistence. */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,

  /** Load all settings from the backend, falling back to defaults on error. */
  loadSettings: async () => {
    set({ loading: true });
    try {
      const map = await invoke<Record<string, string>>("get_all_settings");
      set({ settings: { ...defaultSettings, ...map } });
    } catch {
      // use defaults on error
    } finally {
      set({ loading: false });
    }
  },

  /** Persist a single setting and update local state. */
  updateSetting: async (key: string, value: string) => {
    await invoke("update_setting", { key, value });
    set({ settings: { ...get().settings, [key]: value } });
  },

  /** Persist multiple settings at once and update local state. */
  updateSettingsBatch: async (pairs: [string, string][]) => {
    await invoke("update_settings_batch", { pairs });
    const updated = { ...get().settings };
    for (const [k, v] of pairs) {
      updated[k] = v;
    }
    set({ settings: updated });
  },
}));
