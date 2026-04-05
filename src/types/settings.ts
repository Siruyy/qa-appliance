export interface AppSettings {
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
  [key: string]: string;
}

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
}

/** Parse raw string settings into typed settings */
export function parseSettings(raw: AppSettings): TypedSettings {
  return {
    store_name: raw.store_name ?? 'Quality Appliance',
    currency_symbol: raw.currency_symbol ?? '₱',
    default_interest_rate: parseFloat(raw.default_interest_rate) || 0,
    default_penalty_rate: parseFloat(raw.default_penalty_rate) || 0,
    default_down_payment_pct: parseFloat(raw.default_down_payment_pct) || 30,
    low_stock_threshold: parseInt(raw.low_stock_threshold, 10) || 5,
    default_installment_term: parseInt(raw.default_term_months, 10) || 6,
    receipt_footer: raw.receipt_footer ?? '',
  };
}
