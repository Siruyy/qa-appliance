# Quality Appliance — Post-Audit Implementation Plan

> **Reference:** See `docs/11-audit-report.md` for full findings and rationale.
>
> Phases are ordered by risk and value. Each phase is independently deliverable.

---

## Phase 8A — Critical & Breaking Fixes

> Fix broken/wrong behavior that affects correctness today.

### Task A1 — Add `cost_price_snapshot` to `sale_items` (DB migration V3) ⚠️ CRITICAL

**Audit ref:** §4.2

**Problem:** P&L report joins live `product_variants.cost_price` instead of capturing the cost at time of sale. Historical reports drift whenever a variant's cost is updated.

**Work:**
1. `src-tauri/src/db/migrations.rs` — add `migrate_v3()`:
   ```sql
   ALTER TABLE sale_items ADD COLUMN cost_price_snapshot REAL NOT NULL DEFAULT 0;
   ```
   Back-fill: `UPDATE sale_items SET cost_price_snapshot = (SELECT cost_price FROM product_variants WHERE id = variant_id);`
2. `src-tauri/src/commands/sales.rs` `create_sale` — capture `cost_price` from the variant at insert time into `cost_price_snapshot`
3. `src-tauri/src/commands/reports.rs` `get_profit_loss_report` — change join to use `si.cost_price_snapshot` instead of `v.cost_price`
4. `src-tauri/src/models/sale.rs` — add `cost_price_snapshot` to `SaleItem` struct

---

### Task A2 — Fix `text-warning` / `bg-warning` undefined CSS classes ⚠️ HIGH

**Audit ref:** §6.2

**Problem:** `bg-warning` and `text-warning-foreground` are used in `InventoryPage` but are not registered in the Tailwind v4 `@theme` block. The Low Stock badge renders unstyled.

**Work:**
1. `src/styles/globals.css` — add to `@theme inline {}`:
   ```css
   --color-warning: var(--color-warning);
   --color-warning-foreground: #FFFFFF;
   ```
   And add custom utility classes under `@layer utilities`:
   ```css
   .bg-warning { background-color: var(--color-warning); }
   .text-warning-foreground { color: #FFFFFF; }
   .text-warning { color: var(--color-warning); }
   ```

---

### Task A3 — Fix `formatCurrency` to use settings `currency_symbol` ⚠️ HIGH

**Audit ref:** §4.1

**Problem:** `formatCurrency` always formats as PHP regardless of the `currency_symbol` setting.

**Work:**
1. Update `src/lib/formatters.ts` — add a `formatCurrencyWith(amount, symbol)` overload:
   ```ts
   export function formatCurrency(amount: number, symbol = "₱"): string {
     return `${symbol}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
   }
   ```
   Drop the `Intl.NumberFormat` dependency (it hardcodes locale).
2. Create `src/hooks/useCurrency.ts` — returns a `format(amount)` function reading from `settingsStore`
3. Replace all `formatCurrency(x)` call sites with the hook-based formatter OR pass symbol from settings — choose one approach and apply consistently

---

### Task A4 — Wire settings defaults into New Sale form ⚠️ HIGH

**Audit ref:** §4.3, §1.6

**Problem:** `defaultInstallment` in `NewSalePage` hardcodes `interest_rate: 0`, `penalty_rate: 5`, `term_months: 6` instead of reading from settings.

**Work:**
1. `src/pages/sales/NewSalePage.tsx` — replace `const defaultInstallment = { … }` constant with a function that reads from `useSettingsStore`:
   ```ts
   const { settings } = useSettingsStore();
   const defaultInstallment = useMemo(() => ({
     down_payment: 0,
     interest_rate: parseFloat(settings.default_interest_rate),
     penalty_rate: parseFloat(settings.default_penalty_rate),
     term_months: parseInt(settings.default_term_months),
     has_schedule: true,
     start_date: new Date().toISOString().split("T")[0],
   }), [settings]);
   ```

---

### Task A5 — Fix `filteredSales` date filter not applying client-side ⚠️ HIGH

**Audit ref:** §1.7

**Problem:** Changing `dateFrom`/`dateTo` in `SalesHistoryPage` does not trigger a server refetch, so date-filtered results are never shown.

**Work:**
1. `src/pages/sales/SalesHistoryPage.tsx` — add `useEffect` that calls `fetchSales()` whenever `filters.dateFrom` or `filters.dateTo` changes
2. `src/stores/saleStore.ts` — `filteredSales()` can also apply client-side date filter as a secondary guard (belt-and-suspenders)

---

## Phase 8B — Light / Dark Mode

> Add proper light/dark mode toggle with persistent preference.

### Task B1 — Define dark mode CSS token overrides

**Audit ref:** §5.1, §6.1

**Work:**
1. `src/styles/globals.css` — add a `.dark :root` block with dark-mode overrides for all semantic tokens:
   ```css
   .dark :root {
     --background: #0F172A;
     --foreground: #F1F5F9;
     --card: #1E293B;
     --card-foreground: #F1F5F9;
     --popover: #1E293B;
     --popover-foreground: #F1F5F9;
     --primary: #3B82F6;
     --primary-foreground: #FFFFFF;
     --secondary: #1E293B;
     --secondary-foreground: #CBD5E1;
     --muted: #1E293B;
     --muted-foreground: #94A3B8;
     --accent: #1E3A5F;
     --accent-foreground: #DBEAFE;
     --destructive: #EF4444;
     --border: #334155;
     --input: #334155;
     --ring: #3B82F6;
     /* Sidebar stays dark in both modes */
     --sidebar: #0F172A;
     --sidebar-foreground: #94A3B8;
     --sidebar-accent: #1E293B;
     --sidebar-accent-foreground: #E2E8F0;
     --sidebar-border: #1E293B;
   }
   ```
2. Fix `TopBar.tsx` — change `bg-white` → `bg-background`
3. Fix `AppShell.tsx` main — ensure `bg-background` (already set)

---

### Task B2 — Add theme toggle to `uiStore` and persist

**Work:**
1. `src/stores/uiStore.ts` — add `theme: "light" | "dark" | "system"` state + `setTheme()` action + read from `localStorage` on init
2. `src/app/App.tsx` or root component — `useEffect` that applies `.dark` class to `document.documentElement` based on `theme` state
3. `src/app/layout/TopBar.tsx` — add Sun/Moon toggle button that calls `setTheme()`

---

### Task B3 — Audit all hardcoded colors and fix for dark mode

**Work:**
- Grep for `bg-white`, `bg-gray-*`, `text-gray-*`, `border-gray-*` hardcoded classes throughout the codebase
- Replace with semantic tokens: `bg-background`, `bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`
- Pay special attention to: `Sidebar.tsx` (has hardcoded slate values), modal overlays, `TopBar.tsx`

---

## Phase 8C — Enterprise Layout Polish

> Standardize all page layouts to a consistent, professional pattern.

### Task C1 — Create shared `PageHeader` component

**Audit ref:** §6.3, §1.5

**Work:**
1. Create `src/components/PageHeader.tsx`:
   ```tsx
   interface PageHeaderProps {
     title: string;
     description?: string;
     actions?: React.ReactNode;
   }
   export function PageHeader({ title, description, actions }: PageHeaderProps) {
     return (
       <div className="flex items-start justify-between">
         <div>
           <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
           {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
         </div>
         {actions && <div className="flex items-center gap-2">{actions}</div>}
       </div>
     );
   }
   ```
2. Replace inline header blocks in: `CustomersPage`, `SalesHistoryPage`, `AccountsPage`, `InventoryPage`, `ReportsPage`, `ImportExportPage`, `SettingsPage`, `DashboardPage`
3. Remove duplicate page title `<h1>` tags — TopBar's title is the one source of truth for the tab; `PageHeader` is the in-page heading

---

### Task C2 — Create shared `EmptyState` component

**Audit ref:** §6.7

**Work:**
1. Create `src/components/EmptyState.tsx`:
   ```tsx
   interface EmptyStateProps {
     icon: React.ElementType;
     title: string;
     description?: string;
     action?: React.ReactNode;
   }
   ```
2. Replace all inline empty states across: `InventoryPage`, `CustomersPage`, `SalesHistoryPage`, `AccountsPage`, `PaymentsPage`

---

### Task C3 — Create shared `LoadingSkeleton` / `TableSkeleton` component

**Audit ref:** §6.6

**Work:**
1. Create `src/components/TableSkeleton.tsx` — renders N rows of animated shimmer cells matching the table column count
2. Replace all `"Loading products…"` text placeholders with `<TableSkeleton cols={7} rows={5} />`

---

### Task C4 — Collapse `uiStore.sidebarCollapsed` into working feature

**Audit ref:** §5.4

**Work:**
1. `src/app/layout/Sidebar.tsx` — read `sidebarCollapsed` from `uiStore`, animate width with `w-60` (expanded) / `w-16` (collapsed)
2. When collapsed: hide text labels, show only icons centered
3. Add a collapse toggle button at the bottom of the sidebar
4. `src/app/layout/AppShell.tsx` — conditionally apply `w-60` or `w-16` to the sidebar container

---

### Task C5 — Standardize table row hover and action patterns

**Audit ref:** §6.5, §1.8

**Work:**
1. All data table rows: use `hover:bg-muted/50`
2. All `DropdownMenuTrigger` buttons: use `asChild` with a proper `<Button variant="ghost" size="icon">` child
3. Clickable rows: ensure `cursor-pointer` is consistently applied

---

## Phase 8D — Performance Improvements

> Reduce memory use and improve responsiveness for large datasets.

### Task D1 — Add server-side pagination to all list commands

**Audit ref:** §3.1

**Work (backend):**
1. Add `limit: Option<u32>` and `offset: Option<u32>` params to: `get_products`, `get_customers`, `get_sales`, `get_accounts`, `get_payments`
2. Return a `PaginatedResult<T> { items: Vec<T>, total: u32 }` from each command

**Work (frontend):**
1. Add a `<Pagination>` component (shadcn/ui pagination)
2. Wire page state into each list hook — `page`, `pageSize`, `totalCount`
3. Update store: add `page`, `pageSize`, `totalCount` fields and actions

---

### Task D2 — Fix double `loadSettings` call

**Audit ref:** §3.2

**Work:**
1. `src/pages/dashboard/DashboardPage.tsx` — remove `loadSettings()` call from `load()`. Settings are already loaded by `AppShell` before any page mounts
2. `src/pages/settings/SettingsPage.tsx` — keep `loadSettings()` call here (it's the settings page, refresh makes sense) but guard with: `if (Object.keys(settings).length === 0) loadSettings()`

---

### Task D3 — Memoize filtered store computations

**Audit ref:** §3.4

**Work:**
1. In `InventoryPage`, `CustomersPage`, `SalesHistoryPage`, `AccountsPage` — replace `const products = filteredProducts()` with `const products = useMemo(() => filteredProducts(), [filters, storeData])`
2. Or convert the store methods to use Zustand's selector with shallow equality

---

## Phase 8E — Feature Completeness

> Wire up existing infrastructure and fill critical UX gaps.

### Task E1 — Add `preset_terms` quick-select to InstallmentConfigPanel

**Audit ref:** §4.4

**Work:**
1. `src/pages/sales/InstallmentConfigPanel.tsx` — read `settings.preset_terms` from `useSettingsStore`
2. Parse the comma-separated string into term options
3. Render as a `ToggleGroup` or radio button row above the free-form term input

---

### Task E2 — Add search/filter to Payments page

**Audit ref:** §5.2

**Work:**
1. `src/pages/payments/PaymentsPage.tsx` — add search input (by customer name) and date range filter
2. Update `get_payments` Rust command to accept `search` and `date_from`/`date_to` parameters

---

### Task E3 — Add outstanding balance to Customers list

**Audit ref:** §5.5

**Work:**
1. `src-tauri/src/commands/customers.rs` `get_customers` — add subquery for total outstanding balance per customer:
   ```sql
   COALESCE((SELECT SUM(balance_remaining) FROM installment_accounts ia 
             WHERE ia.customer_id = c.id AND ia.status = 'open'), 0) AS total_balance
   ```
2. `src/types/customer.ts` `Customer` interface — add `total_balance: number`
3. `src/pages/customers/CustomersPage.tsx` — add "Outstanding" column to the customers table

---

### Task E4 — Add keyboard shortcut help overlay

**Audit ref:** §5.6

**Work:**
1. Create `src/components/KeyboardShortcutsModal.tsx` listing all shortcuts
2. Register `?` key in `AppShell.tsx` keyboard listener to open the modal

---

### Task E5 — Add print/receipt for sales

**Audit ref:** §5.3

**Work:**
1. Create `src/components/SaleReceipt.tsx` — a printable receipt layout
2. In `SaleDetailModal.tsx` — add a "Print Receipt" button that opens a print preview dialog
3. Use Tauri's `WebviewWindow` or CSS `@media print` to render the receipt cleanly
4. Add similar "Print" button to the Account Detail page for payment history

---

### Task E6 — Add "Recalculate Balance" button to Account Detail UI

**Audit ref:** §5.8

**Work:**
1. `src/pages/accounts/AccountDetailPage.tsx` — add a secondary action "Recalculate Balance" button (visible only to admin, or behind a confirm dialog)
2. Calls existing `recalculate_balance` Rust command

---

## Phase 8F — Code Quality Cleanup

> DRY up the codebase, remove dead code, standardize patterns.

### Task F1 — Extract unified `KpiCard` component

**Audit ref:** §1.1

**Work:**
1. Create `src/components/KpiCard.tsx` with unified props:
   ```ts
   interface KpiCardProps {
     title: string;
     value: string | number;
     description?: string;
     type?: "currency" | "number" | "percent";
     alert?: boolean;
   }
   ```
2. Delete `src/pages/reports/KpiCard.tsx`
3. Remove local `KpiCard` from `DashboardPage.tsx`
4. Update all import sites

---

### Task F2 — Remove dead `DashboardStats` type

**Audit ref:** §1.4

**Work:**
1. `src/types/report.ts` — remove the `DashboardStats` interface if it has no references

---

### Task F3 — Standardize `invoke` wrapper usage

**Audit ref:** §1.2

**Work:**
1. Decide on one pattern — recommend keeping `src/lib/invoke.ts` wrapper but removing the `console.error` and re-exporting as a simple re-export in dev builds
2. Update `settingsStore.ts`, `AppShell.tsx`, `useDashboard.ts` to use `@/lib/invoke` instead of `@tauri-apps/api/core`

---

### Task F4 — Remove `console.error` from production paths

**Audit ref:** §2.1

**Work:**
1. `src/lib/invoke.ts` — remove or gate with `import.meta.env.DEV`
2. `src/app/layout/AppShell.tsx` — remove `console.error("Penalty check failed:", err)`

---

### Task F5 — Unify Rust date utility

**Audit ref:** §4.7, §7.3

**Work:**
1. Create `src-tauri/src/utils/date.rs`:
   ```rust
   pub fn today_iso() -> String { … }  // civil_from_days implementation
   ```
2. Remove duplicate `chrono_today()` from `penalty.rs`
3. Remove inline date logic from `dashboard.rs`
4. Export via `src-tauri/src/utils/mod.rs`

---

### Task F6 — Add Zod `max()` length constraints

**Audit ref:** §2.3

**Work:**
1. Customer name: `.max(100)`; notes: `.max(500)`
2. Product name: `.max(150)`; SKU: `.max(50)`
3. All free-text fields: add a reasonable max

---

### Task F7 — Fix ESLint `exhaustive-deps` suppressions

**Audit ref:** §7.6

**Work:**
1. `AccountsPage`, `AccountDetailPage`, `SalesHistoryPage` — replace `// eslint-disable-next-line` with proper `useCallback` + stable dependency arrays

---

## Priority Summary

| Phase | Focus | Risk Level |
|-------|-------|-----------|
| **8A** | Critical fixes (P&L cost snapshot, CSS warning class, currency, settings defaults, date filter) | 🔴 Critical / High |
| **8B** | Light/dark mode | 🟠 High |
| **8C** | Enterprise layout polish | 🟡 Medium |
| **8D** | Performance / pagination | 🟡 Medium |
| **8E** | Feature completeness | 🟡 Medium |
| **8F** | Code quality cleanup | 🟢 Low–Medium |

---

## Implementation Status

All 29 tasks across Phases 8A–8F have been implemented.

| Phase | Tasks | Status |
|-------|-------|--------|
| **8A** | A1–A5 | ✅ Complete |
| **8B** | B1–B2 | ✅ Complete |
| **8C** | C1–C5 | ✅ Complete |
| **8D** | D1 | ✅ Complete |
| **8E** | E1–E6 | ✅ Complete |
| **8F** | F1–F7 | ✅ Complete |

### Phase 8F — Completed Tasks

| Task | Description | Commit |
|------|-------------|--------|
| F1 | Extract unified `KpiCard` to `src/components/KpiCard.tsx` | ae20ff1 |
| F2 | Remove dead `DashboardStats` interface from `report.ts` | a778a0b |
| F3 | Standardize all IPC calls through `@/lib/invoke` wrapper | 8061b27 |
| F4 | Gate `console.error` behind `import.meta.env.DEV` | 5c44599 |
| F5 | Unify Rust date utilities into `src-tauri/src/utils/date.rs` | deacfa4 |
| F6 | Add Zod `max()` length constraints to all validation schemas | 37b4229 |
| F7 | Fix ESLint exhaustive-deps suppressions with `useCallback` | 6f630b5 |

---

*This plan supersedes any individual phase notes. All phases have been implemented and committed.*
