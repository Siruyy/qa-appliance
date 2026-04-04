import { useCallback } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { formatCurrency } from "@/lib/formatters";

/**
 * Returns a `format` function bound to the current currency_symbol setting.
 * Use this instead of calling formatCurrency directly so currency is consistent
 * with whatever the user configured in Settings.
 */
export function useCurrency() {
  const symbol = useSettingsStore((s) => s.settings.currency_symbol);

  const format = useCallback(
    (amount: number) => formatCurrency(amount, symbol),
    [symbol],
  );

  return { format, symbol };
}
