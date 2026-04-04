import { Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { InventoryPage } from "@/pages/inventory/InventoryPage";
import { CustomersPage } from "@/pages/customers/CustomersPage";
import { CustomerDetailPage } from "@/pages/customers/CustomerDetailPage";
import { NewSalePage } from "@/pages/sales/NewSalePage";
import { SalesHistoryPage } from "@/pages/sales/SalesHistoryPage";
import { AccountsPage } from "@/pages/accounts/AccountsPage";
import { AccountDetailPage } from "@/pages/accounts/AccountDetailPage";
import { PaymentsPage } from "@/pages/payments/PaymentsPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { ImportExportPage } from "@/pages/import-export/ImportExportPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";

function Wrap({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
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
    </Routes>
  );
}
