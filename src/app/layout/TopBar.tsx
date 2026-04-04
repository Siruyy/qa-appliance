import { useLocation, Link } from "react-router-dom";
import { Settings as SettingsIcon } from "lucide-react";
import { format } from "date-fns";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/inventory": "Inventory",
  "/customers": "Customers",
  "/sales/new": "New Sale",
  "/sales": "Sales History",
  "/accounts": "Accounts",
  "/payments": "Payments",
  "/reports": "Reports",
  "/import-export": "Import / Export",
  "/settings": "Settings",
};

export function TopBar() {
  const location = useLocation();
  const pathKey = Object.keys(pageTitles).find((key) =>
    location.pathname.startsWith(key)
  );
  const title = pathKey ? pageTitles[pathKey] : "Quality Appliance";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-white px-6">
      <h1 className="text-lg font-semibold text-[var(--foreground)]">
        {title}
      </h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-[var(--muted-foreground)]">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </span>
        <Link
          to="/settings"
          className="rounded-md p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          aria-label="Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
