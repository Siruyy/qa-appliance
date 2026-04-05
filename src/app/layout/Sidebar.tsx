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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

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
  collapsed,
}: {
  to: string;
  label: string;
  icon: React.ElementType;
  accent?: boolean;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          collapsed && "justify-center px-2",
          isActive
            ? "border-l-[3px] border-[var(--cta)] bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]"
            : "border-l-[3px] border-transparent text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
          accent && !isActive && "text-[var(--cta)]"
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] transition-all duration-200",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex h-14 items-center gap-2 px-4",
          sidebarCollapsed && "justify-center px-0"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--cta)] text-[var(--cta-foreground)] font-bold text-sm">
          QA
        </div>
        {!sidebarCollapsed && (
          <span className="text-base font-semibold text-[var(--sidebar-accent-foreground)]">
            Quality Appliance
          </span>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pt-4">
        {!sidebarCollapsed && (
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-foreground)]/60">
            Main
          </p>
        )}
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} collapsed={sidebarCollapsed} />
        ))}

        <div className="my-4" />

        {!sidebarCollapsed && (
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-foreground)]/60">
            System
          </p>
        )}
        {systemNav.map((item) => (
          <NavItem key={item.to} {...item} collapsed={sidebarCollapsed} />
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-[var(--sidebar-border)] p-2">
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--sidebar-foreground)]/60 transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
            sidebarCollapsed && "justify-center px-2"
          )}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
