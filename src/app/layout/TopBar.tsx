import { useLocation, Link } from "react-router-dom";
import { Settings as SettingsIcon, Sun, Moon, Monitor } from "lucide-react";
import { format } from "date-fns";
import { useUIStore } from "@/stores/uiStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const pathKey = Object.keys(pageTitles).find((key) =>
    location.pathname.startsWith(key)
  );
  const title = pathKey ? pageTitles[pathKey] : "Quality Appliance";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-lg font-semibold text-foreground">
        {title}
      </h1>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Toggle theme">
            {theme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : theme === "light" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Monitor className="h-4 w-4" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" /> Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" /> Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" /> System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Link
          to="/settings"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
