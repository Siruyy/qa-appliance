import { lazy, Suspense } from "react";
import { createHashRouter, RouterProvider, Navigate, Outlet } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotFoundPage } from "@/pages/errors/NotFoundPage";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/app/layout/AppShell";

const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const InventoryPage = lazy(() => import("@/pages/inventory/InventoryPage").then(m => ({ default: m.InventoryPage })));
const CustomersPage = lazy(() => import("@/pages/customers/CustomersPage").then(m => ({ default: m.CustomersPage })));
const CustomerDetailPage = lazy(() => import("@/pages/customers/CustomerDetailPage").then(m => ({ default: m.CustomerDetailPage })));
const NewSalePage = lazy(() => import("@/pages/sales/NewSalePage").then(m => ({ default: m.NewSalePage })));
const SalesHistoryPage = lazy(() => import("@/pages/sales/SalesHistoryPage").then(m => ({ default: m.SalesHistoryPage })));
const AccountsPage = lazy(() => import("@/pages/accounts/AccountsPage").then(m => ({ default: m.AccountsPage })));
const AccountDetailPage = lazy(() => import("@/pages/accounts/AccountDetailPage").then(m => ({ default: m.AccountDetailPage })));
const PaymentsPage = lazy(() => import("@/pages/payments/PaymentsPage").then(m => ({ default: m.PaymentsPage })));
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage").then(m => ({ default: m.ReportsPage })));
const ImportExportPage = lazy(() => import("@/pages/import-export/ImportExportPage").then(m => ({ default: m.ImportExportPage })));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function LayoutWrapper() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

const router = createHashRouter([
  {
    element: <LayoutWrapper />,
    children: [
      { path: "/", element: <Navigate to="/dashboard" replace /> },
      { path: "/dashboard", element: <Wrap><DashboardPage /></Wrap> },
      { path: "/inventory", element: <Wrap><InventoryPage /></Wrap> },
      { path: "/customers", element: <Wrap><CustomersPage /></Wrap> },
      { path: "/customers/:id", element: <Wrap><CustomerDetailPage /></Wrap> },
      { path: "/sales/new", element: <Wrap><NewSalePage /></Wrap> },
      { path: "/sales", element: <Wrap><SalesHistoryPage /></Wrap> },
      { path: "/accounts", element: <Wrap><AccountsPage /></Wrap> },
      { path: "/accounts/:id", element: <Wrap><AccountDetailPage /></Wrap> },
      { path: "/payments", element: <Wrap><PaymentsPage /></Wrap> },
      { path: "/reports", element: <Wrap><ReportsPage /></Wrap> },
      { path: "/import-export", element: <Wrap><ImportExportPage /></Wrap> },
      { path: "/settings", element: <Wrap><SettingsPage /></Wrap> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
