export interface AppSettings extends Record<string, string> {
  default_interest_rate: string;
  default_penalty_rate: string;
  default_term_months: string;
  default_down_payment_pct: string;
  low_stock_threshold: string;
  store_name: string;
  store_address: string;
  store_phone: string;
  currency_symbol: string;
  preset_terms: string;
  receipt_footer: string;
  rebate_enabled: string;
  default_rebate_rate: string;
}

/** Known setting key names for type-safe access. */
export type SettingsKey = keyof AppSettings;

/** Typed settings with proper number/boolean types */
export interface TypedSettings {
  store_name: string;
  currency_symbol: string;
  default_interest_rate: number;
  default_penalty_rate: number;
  default_down_payment_pct: number;
  low_stock_threshold: number;
  default_installment_term: number;
  receipt_footer: string;
  rebate_enabled: boolean;
  default_rebate_rate: number;
}

/** Parse raw string settings into typed settings */
export function parseSettings(raw: AppSettings): TypedSettings {
  return {
    store_name: raw.store_name ?? 'Quality Appliance',
    currency_symbol: raw.currency_symbol ?? '₱',
    default_interest_rate: parseFloat(raw.default_interest_rate) || 0,
    default_penalty_rate: parseFloat(raw.default_penalty_rate) || 0,
    default_down_payment_pct: parseFloat(raw.default_down_payment_pct) || 20,
    low_stock_threshold: parseInt(raw.low_stock_threshold, 10) || 5,
    default_installment_term: parseInt(raw.default_term_months, 10) || 6,
    receipt_footer: raw.receipt_footer ?? '',
    rebate_enabled: raw.rebate_enabled === '1',
    default_rebate_rate: parseFloat(raw.default_rebate_rate) || 0,
  };
}
