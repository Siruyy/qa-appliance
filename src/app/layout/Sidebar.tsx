import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  CreditCard,
  Banknote,
  BarChart2,
  ArrowUpDown,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/sales/new", label: "New Sale", icon: ShoppingCart, accent: true },
  { to: "/accounts", label: "Accounts", icon: CreditCard },
  { to: "/payments", label: "Payments", icon: Banknote },
  { to: "/reports", label: "Reports", icon: BarChart2 },
];

const systemNav = [
  { to: "/import-export", label: "Import / Export", icon: ArrowUpDown },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavItem({
  to,
  label,
  icon: Icon,
  accent,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "border-l-[3px] border-[var(--sidebar-primary)] bg-[var(--sidebar-primary)] text-white"
            : "border-l-[3px] border-transparent text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
          accent && !isActive && "text-blue-300"
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--sidebar-primary)] text-white font-bold text-sm">
          QA
        </div>
        <span className="text-base font-semibold text-white">
          Quality Appliance
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pt-4">
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Main
        </p>
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <div className="my-4" />

        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          System
        </p>
        {systemNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>
    </aside>
  );
}
