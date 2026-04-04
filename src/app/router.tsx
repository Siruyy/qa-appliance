import { Routes, Route, Navigate } from "react-router-dom";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { InventoryPage } from "@/pages/inventory/InventoryPage";
import { CustomersPage } from "@/pages/customers/CustomersPage";
import { NewSalePage } from "@/pages/sales/NewSalePage";
import { SalesHistoryPage } from "@/pages/sales/SalesHistoryPage";
import { AccountsPage } from "@/pages/accounts/AccountsPage";
import { AccountDetailPage } from "@/pages/accounts/AccountDetailPage";
import { PaymentsPage } from "@/pages/payments/PaymentsPage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { ImportExportPage } from "@/pages/import-export/ImportExportPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/inventory" element={<InventoryPage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/sales/new" element={<NewSalePage />} />
      <Route path="/sales" element={<SalesHistoryPage />} />
      <Route path="/accounts" element={<AccountsPage />} />
      <Route path="/accounts/:id" element={<AccountDetailPage />} />
      <Route path="/payments" element={<PaymentsPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/import-export" element={<ImportExportPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
