import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotFoundPage } from "@/pages/errors/NotFoundPage";
import { Loader2 } from "lucide-react";

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

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Wrap><DashboardPage /></Wrap>} />
      <Route path="/inventory" element={<Wrap><InventoryPage /></Wrap>} />
      <Route path="/customers" element={<Wrap><CustomersPage /></Wrap>} />
      <Route path="/customers/:id" element={<Wrap><CustomerDetailPage /></Wrap>} />
      <Route path="/sales/new" element={<Wrap><NewSalePage /></Wrap>} />
      <Route path="/sales" element={<Wrap><SalesHistoryPage /></Wrap>} />
      <Route path="/accounts" element={<Wrap><AccountsPage /></Wrap>} />
      <Route path="/accounts/:id" element={<Wrap><AccountDetailPage /></Wrap>} />
      <Route path="/payments" element={<Wrap><PaymentsPage /></Wrap>} />
      <Route path="/reports" element={<Wrap><ReportsPage /></Wrap>} />
      <Route path="/import-export" element={<Wrap><ImportExportPage /></Wrap>} />
      <Route path="/settings" element={<Wrap><SettingsPage /></Wrap>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
