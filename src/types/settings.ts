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
