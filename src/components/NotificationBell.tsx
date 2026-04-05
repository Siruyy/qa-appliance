import { useState, useEffect, useCallback } from "react";
import { Bell, AlertTriangle, Package, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { invoke } from "@/lib/invoke";
import { useCurrency } from "@/hooks/useCurrency";

interface Alerts {
  overdueCount: number;
  overdueTotal: number;
  lowStockCount: number;
}

export function NotificationBell() {
  const [alerts, setAlerts] = useState<Alerts>({
    overdueCount: 0,
    overdueTotal: 0,
    lowStockCount: 0,
  });
  const { format: fmt } = useCurrency();

  const refresh = useCallback(async () => {
    try {
      const data = await invoke<{
        overdue_accounts_count: number;
        overdue_total: number;
        low_stock_count: number;
      }>("get_dashboard_data", { lowStockThreshold: 2 });
      setAlerts({
        overdueCount: data.overdue_accounts_count,
        overdueTotal: data.overdue_total,
        lowStockCount: data.low_stock_count,
      });
    } catch {
      // silent — dashboard may not be available
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5 * 60_000); // refresh every 5 min
    return () => clearInterval(id);
  }, [refresh]);

  const totalAlerts = alerts.overdueCount + alerts.lowStockCount;

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
                {totalAlerts}
              </span>
            )}
          </button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
        </div>
        <div className="divide-y">
          {totalAlerts === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              All clear — no alerts right now.
            </p>
          ) : (
            <>
              {alerts.overdueCount > 0 && (
                <Link
                  to="/accounts"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--danger-bg)]">
                    <AlertTriangle className="h-4 w-4 text-[var(--danger)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {alerts.overdueCount} overdue account{alerts.overdueCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(alerts.overdueTotal)} outstanding
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )}
              {alerts.lowStockCount > 0 && (
                <Link
                  to="/inventory"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--warning-bg)]">
                    <Package className="h-4 w-4 text-[var(--warning)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {alerts.lowStockCount} low stock item{alerts.lowStockCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Below threshold — restock needed
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
