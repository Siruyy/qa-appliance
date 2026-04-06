import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bell,
  AlertTriangle,
  Package,
  CalendarClock,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { invoke } from "@/lib/invoke";
import { useCurrency } from "@/hooks/useCurrency";
import { formatDate } from "@/lib/formatters";
import { useSettingsStore } from "@/stores/settingsStore";
import { parseSettings } from "@/types/settings";

interface OverdueAccountAlert {
  id: number;
  customer_name: string;
  balance_remaining: number;
  days_overdue: number;
  product_summary: string;
}

interface LowStockAlert {
  variant_id: number;
  product_name: string;
  attributes: string;
  stock_qty: number;
  low_stock_threshold: number;
}

interface UpcomingDue {
  account_id: number;
  customer_name: string;
  due_date: string;
  amount_due: number;
  product_summary: string;
}

interface NotificationData {
  overdue_accounts_count: number;
  overdue_total: number;
  low_stock_count: number;
  overdue_accounts: OverdueAccountAlert[];
  low_stock_items: LowStockAlert[];
  upcoming_due: UpcomingDue[];
}

function parseAttributes(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    const vals = Object.values(obj as Record<string, string>).filter(Boolean);
    return vals.length > 0 ? vals.join(" / ") : "";
  } catch {
    return "";
  }
}

function getVariantLabel(item: LowStockAlert): string {
  const attrs = parseAttributes(item.attributes);
  return attrs ? `${item.product_name} (${attrs})` : item.product_name;
}

const REFRESH_INTERVAL_MS = 5 * 60_000;

export function NotificationBell() {
  const [data, setData] = useState<NotificationData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const { format: fmt } = useCurrency();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lowStockThreshold = useSettingsStore(
    (s) => parseSettings(s.settings).low_stock_threshold
  );

  const refresh = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const result = await invoke<NotificationData>("get_dashboard_data", {
        lowStockThreshold,
      });
      setData(result);
      setLastChecked(new Date());
    } catch {
      // silent — avoid noise if dashboard is unavailable
    } finally {
      if (manual) setRefreshing(false);
    }
  }, [lowStockThreshold]);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(() => refresh(), REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  // Due within next 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  const dueSoon: UpcomingDue[] = (data?.upcoming_due ?? []).filter((u) => {
    const d = new Date(u.due_date);
    return d >= today && d <= in7Days;
  });

  const dueToday: UpcomingDue[] = (data?.upcoming_due ?? []).filter((u) => {
    const d = new Date(u.due_date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const overdueCount = data?.overdue_accounts_count ?? 0;
  const lowStockCount = data?.low_stock_count ?? 0;
  const dueTodayCount = dueToday.length;

  const totalAlerts = overdueCount + lowStockCount + dueTodayCount;

  const lastCheckedLabel = (() => {
    if (!lastChecked) return null;
    const mins = Math.floor((Date.now() - lastChecked.getTime()) / 60_000);
    if (mins < 1) return "just now";
    if (mins === 1) return "1 min ago";
    return `${mins} min ago`;
  })();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={`Notifications${totalAlerts > 0 ? ` (${totalAlerts} alerts)` : ""}`}
          >
            <Bell className="h-4 w-4" />
            {totalAlerts > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">
                {totalAlerts > 9 ? "9+" : totalAlerts}
              </span>
            )}
          </button>
        }
      />
      <PopoverContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <button
            onClick={() => refresh(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh notifications"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            {lastCheckedLabel && <span>{lastCheckedLabel}</span>}
          </button>
        </div>

        <div className="divide-y max-h-[480px] overflow-y-auto">
          {totalAlerts === 0 && overdueCount === 0 && lowStockCount === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              All clear — no alerts right now.
            </p>
          ) : (
            <>
              {/* ── Overdue Accounts ── */}
              {overdueCount > 0 && (
                <div>
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--danger)]">
                      Overdue Accounts
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fmt(data?.overdue_total ?? 0)} total
                    </span>
                  </div>
                  {(data?.overdue_accounts ?? []).map((acct) => (
                    <Link
                      key={acct.id}
                      to={`/accounts/${acct.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--danger-bg)]">
                        <AlertTriangle className="h-4 w-4 text-[var(--danger)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{acct.customer_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {acct.product_summary} · {fmt(acct.balance_remaining)} · {acct.days_overdue}d overdue
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                  {overdueCount > (data?.overdue_accounts.length ?? 0) && (
                    <Link
                      to="/accounts"
                      className="flex items-center justify-center gap-1 px-4 py-2 text-xs text-[var(--danger)] hover:underline"
                    >
                      View all {overdueCount} overdue accounts
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}

              {/* ── Due Today ── */}
              {dueToday.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--warning)]">
                      Due Today
                    </span>
                  </div>
                  {dueToday.slice(0, 4).map((u) => (
                    <Link
                      key={u.account_id}
                      to={`/accounts/${u.account_id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--warning-bg)]">
                        <CalendarClock className="h-4 w-4 text-[var(--warning)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.customer_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.product_summary} · {fmt(u.amount_due)} due today
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                  {dueToday.length > 4 && (
                    <Link
                      to="/accounts"
                      className="flex items-center justify-center gap-1 px-4 py-2 text-xs text-[var(--warning)] hover:underline"
                    >
                      +{dueToday.length - 4} more due today
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}

              {/* ── Due This Week (non-today) ── */}
              {dueSoon.filter((u) => !dueToday.includes(u)).length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Due This Week
                    </span>
                  </div>
                  {dueSoon
                    .filter((u) => !dueToday.includes(u))
                    .slice(0, 3)
                    .map((u) => (
                      <Link
                        key={u.account_id}
                        to={`/accounts/${u.account_id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                          <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.customer_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.product_summary} · {fmt(u.amount_due)} · {formatDate(u.due_date)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                </div>
              )}

              {/* ── Low Stock ── */}
              {lowStockCount > 0 && (
                <div>
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-orange-500">
                      Low Stock
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lowStockCount} variant{lowStockCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {(data?.low_stock_items ?? []).map((item) => (
                    <Link
                      key={item.variant_id}
                      to="/inventory"
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/30">
                        <Package className="h-4 w-4 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getVariantLabel(item)}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.stock_qty} in stock · threshold: {item.low_stock_threshold}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                  {lowStockCount > (data?.low_stock_items.length ?? 0) && (
                    <Link
                      to="/inventory"
                      className="flex items-center justify-center gap-1 px-4 py-2 text-xs text-orange-500 hover:underline"
                    >
                      View all {lowStockCount} low stock items
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
