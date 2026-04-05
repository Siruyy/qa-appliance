# Quality Appliance — Technical Architecture

## Overview

The application follows a **local desktop architecture** using Tauri v2. There is no network server, no HTTP API, and no cloud dependency. All data lives in a single SQLite file on the user's machine.

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                     React Frontend (TypeScript)                │
│  Pages → Components → Hooks → Stores (Zustand)                │
│  Forms validated with Zod + React Hook Form                    │
│  UI built with shadcn/ui + Tailwind CSS                        │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                    invoke() / IPC
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                   Rust Layer (Tauri Commands)                  │
│  commands/          → handler functions exposed to frontend    │
│  services/          → business logic (interest calc, etc.)    │
│  db/                → SQLite connection, migrations            │
│  models/            → Rust structs (serialize/deserialize)     │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                     rusqlite / r2d2
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│               SQLite Database (.db file)                       │
│         Located at: $APPDATA/quality-appliance/app.db          │
│         (Windows: C:\Users\<user>\AppData\Roaming\...)         │
└────────────────────────────────────────────────────────────────┘
```

---

## Tauri IPC Pattern

The frontend **never** accesses the database directly. All data access goes through Tauri commands (Rust functions tagged with `#[tauri::command]`).

```
Frontend (TypeScript)          Rust (Tauri Command)
─────────────────────          ────────────────────
invoke('get_products')    →    fn get_products() → Vec<Product>
invoke('create_sale', {…}) →   fn create_sale(payload) → Sale
invoke('record_payment', {…})→ fn record_payment(payload) → Payment
```

### Error Handling Contract

Every Tauri command returns `Result<T, String>` on the Rust side. On the TypeScript side, this maps to a resolved `Promise<T>` or a rejected `Promise<string>`.

```typescript
// TypeScript pattern for all invoke calls
try {
  const result = await invoke<Product[]>('get_products')
  return result
} catch (error) {
  // error is a string message from Rust
  toast.error(error as string)
}
```

---

## Frontend State Architecture

```
Zustand Store (global)
  ├── useProductStore     → products list, selected product, filters
  ├── useCustomerStore    → customers list, selected customer
  ├── useSaleStore        → active sale in progress (cart state)
  ├── useAccountStore     → accounts list, overdue list
  ├── useSettingsStore    → app settings (interest rates, defaults)
  └── useUIStore          → sidebar open/close, active page, modals
```

- Stores are **read-only snapshots** refreshed by invoking Rust commands
- No derived state stored in Zustand — compute on the fly with selectors
- Form state is **local** (React Hook Form), not in Zustand

---

## Folder Structure

```
quality-appliance/
├── src/                          # React frontend
│   ├── main.tsx                  # App entry point
│   ├── App.tsx                   # Router + layout wrapper
│   ├── app/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx      # Sidebar + main content wrapper
│   │   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   │   └── TopBar.tsx        # Header with page title
│   │   └── router.tsx            # React Router v6 routes
│   ├── pages/
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── inventory/
│   │   │   ├── InventoryPage.tsx
│   │   │   ├── ProductFormModal.tsx
│   │   │   └── VariantFormModal.tsx
│   │   ├── customers/
│   │   │   ├── CustomersPage.tsx
│   │   │   └── CustomerFormModal.tsx
│   │   ├── sales/
│   │   │   ├── NewSalePage.tsx
│   │   │   └── SalesHistoryPage.tsx
│   │   ├── accounts/
│   │   │   ├── AccountsPage.tsx
│   │   │   └── AccountDetailPage.tsx
│   │   ├── payments/
│   │   │   └── PaymentsPage.tsx
│   │   ├── reports/
│   │   │   ├── ReportsPage.tsx
│   │   │   └── report-types/
│   │   │       ├── SalesSummaryReport.tsx
│   │   │       ├── ReceivablesReport.tsx
│   │   │       ├── InventoryValuationReport.tsx
│   │   │       ├── PaymentCollectionReport.tsx
│   │   │       ├── CustomerHistoryReport.tsx
│   │   │       └── ProfitLossReport.tsx
│   │   ├── import-export/
│   │   │   └── ImportExportPage.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx
│   ├── components/               # Shared/reusable UI components
│   │   ├── ui/                   # shadcn/ui auto-generated components
│   │   ├── forms/
│   │   │   ├── CurrencyInput.tsx
│   │   │   ├── DatePicker.tsx
│   │   │   └── SearchableSelect.tsx
│   │   ├── tables/
│   │   │   ├── DataTable.tsx     # Reusable table with sort/filter
│   │   │   └── Pagination.tsx
│   │   ├── status/
│   │   │   ├── StatusBadge.tsx   # paid / overdue / pending badges
│   │   │   └── AlertBanner.tsx
│   │   └── charts/
│   │       ├── SalesLineChart.tsx
│   │       └── PaymentBarChart.tsx
│   ├── hooks/
│   │   ├── useProducts.ts
│   │   ├── useCustomers.ts
│   │   ├── useSales.ts
│   │   ├── useAccounts.ts
│   │   ├── usePayments.ts
│   │   ├── useReports.ts
│   │   └── useSettings.ts
│   ├── stores/
│   │   ├── productStore.ts
│   │   ├── customerStore.ts
│   │   ├── saleStore.ts
│   │   ├── accountStore.ts
│   │   ├── settingsStore.ts
│   │   └── uiStore.ts
│   ├── lib/
│   │   ├── invoke.ts             # Typed wrappers around tauri invoke()
│   │   ├── formatters.ts         # Currency, date, number formatters
│   │   ├── interest.ts           # Interest/penalty calculation helpers
│   │   └── export/
│   │       ├── toExcel.ts
│   │       ├── toPdf.ts
│   │       └── toCsv.ts
│   ├── types/
│   │   ├── product.ts
│   │   ├── customer.ts
│   │   ├── sale.ts
│   │   ├── account.ts
│   │   ├── payment.ts
│   │   ├── report.ts
│   │   └── settings.ts
│   └── styles/
│       └── globals.css           # Tailwind base + CSS variables
│
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs               # Entry + command registration
│       ├── db/
│       │   ├── mod.rs
│       │   ├── connection.rs     # SQLite connection pool setup
│       │   └── migrations.rs    # Schema creation & version tracking
│       ├── models/
│       │   ├── mod.rs
│       │   ├── product.rs
│       │   ├── customer.rs
│       │   ├── sale.rs
│       │   ├── account.rs
│       │   ├── payment.rs
│       │   └── settings.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── products.rs      # get_products, create_product, update_product, delete_product
│       │   ├── customers.rs     # get_customers, create_customer, update_customer
│       │   ├── sales.rs         # get_sales, create_sale, get_sale_by_id
│       │   ├── accounts.rs      # get_accounts, create_account, get_overdue
│       │   ├── payments.rs      # record_payment, get_payments_for_account
│       │   ├── reports.rs       # all report query commands
│       │   ├── import_export.rs # file dialogs, data import/export
│       │   └── settings.rs      # get_settings, update_setting
│       └── services/
│           ├── mod.rs
│           ├── interest.rs      # Add-on interest calculation
│           ├── penalty.rs       # Overdue penalty detection + application
│           └── schedule.rs      # Payment schedule generation
│
├── docs/                         # This planning docs folder
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Database File Location

| OS | Path |
|----|------|
| Windows | `C:\Users\<user>\AppData\Roaming\quality-appliance\app.db` |
| macOS | `~/Library/Application Support/quality-appliance/app.db` |

The user can copy this file directly as a backup. The Import/Export feature also provides a structured backup/restore mechanism.

---

## Key Architectural Decisions

### 1. Interest Calculation — Add-on / Flat Rate
Default to add-on interest (most common in Filipino appliance stores):
```
total_interest = principal × monthly_rate × term_months
monthly_payment = (principal + total_interest - down_payment) / term_months
```
Configurable per-account. Diminishing balance can be added later if needed.

### 2. Penalty Application
Since there is no background process, penalty checking happens **on app startup** and **when opening the Accounts page**. The logic:
1. Query all open accounts with overdue schedules (or overdue balances for open-ended accounts)
2. For each overdue entry, check if penalty was already applied this period (`last_penalty_date`)
3. If not, apply penalty = `balance × penalty_rate` and record it as a special payment entry

### 3. Immutability in State
All state updates use spread/immutable patterns. Stores never mutate existing objects.

### 4. Type Safety Across the IPC Boundary
TypeScript types in `src/types/` must mirror Rust structs in `src-tauri/src/models/`. Any schema change must be reflected in both.
