# Quality Appliance — Comprehensive Codebase Audit

> **Date:** April 5, 2026
> **Scope:** Full codebase — Rust backend, React/TypeScript frontend, stores, hooks, types, utilities, styling, UX
> **Total Findings:** 83

---

## Table of Contents

1. [Summary Dashboard](#summary-dashboard)
2. [🔴 Critical Issues](#-critical-issues)
3. [🟠 High Severity Issues](#-high-severity-issues)
4. [🟡 Medium Severity Issues](#-medium-severity-issues)
5. [🟢 Low Severity Issues](#-low-severity-issues)
6. [✅ What's Done Well](#-whats-done-well)

---

## Summary Dashboard

| Category | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | Total |
|----------|:-----------:|:-------:|:---------:|:------:|:-----:|
| Business Logic | 4 | 3 | 3 | 0 | **10** |
| Code Quality | 1 | 5 | 6 | 6 | **18** |
| Type Safety | 3 | 1 | 5 | 2 | **11** |
| Security | 0 | 1 | 0 | 1 | **2** |
| Performance | 1 | 4 | 3 | 2 | **10** |
| UI/UX | 1 | 1 | 4 | 4 | **10** |
| Styling | 0 | 0 | 3 | 1 | **4** |
| Feature Gaps | 0 | 1 | 3 | 1 | **5** |
| Database | 0 | 1 | 2 | 0 | **3** |
| Maintainability | 0 | 1 | 4 | 5 | **10** |
| **Total** | **10** | **18** | **33** | **22** | **83** |

---

## 🔴 Critical Issues

### CRIT-01 · Interest calculation formula is wrong
- [ ] **Fixed**
- **Category:** Business Logic
- **File:** `src-tauri/src/commands/sales.rs:285-288`
- **Description:** The spec defines Filipino add-on/flat interest as `total_interest = principal × monthly_rate × term_months`. But the code converts to *years* and multiplies by an *annual* rate:
  ```rust
  let term_years = term as f64 / 12.0;
  let total_interest = principal * (inst.interest_rate / 100.0) * term_years;
  ```
  If the user enters `5` meaning 5% per month, the code treats it as 5% per year — producing ~12× less interest.
- **Impact:** Massively under-charging on installment sales. All existing accounts may have incorrect balances.
- **Fix:** Clarify whether `interest_rate` is monthly or annual. If monthly (per spec): `total_interest = principal * (rate / 100.0) * term_months`. Document the convention and enforce it everywhere.

### CRIT-02 · `recalculate_balance` ignores interest entirely
- [ ] **Fixed**
- **Category:** Business Logic
- **File:** `src-tauri/src/commands/accounts.rs:344-400`
- **Description:** `balance_remaining` at account creation = `principal + total_interest`, but `recalculate_balance` reconstructs from:
  ```rust
  let new_balance = principal - total_payments + total_penalties;
  ```
  Interest is completely omitted. After recalculation, every account's balance drops by the entire interest amount, potentially auto-closing accounts that still owe money.
- **Fix:** Store `total_payable` (principal + interest) in the account row, or recompute interest from stored rate/term during recalculation.

### CRIT-03 · Down payment is not subtracted from `balance_remaining`
- [ ] **Fixed**
- **Category:** Business Logic
- **File:** `src-tauri/src/commands/sales.rs:289-304`
- **Description:** `balance_remaining` is set to `total_payable` (principal + interest). A down payment is recorded as a payment row but does NOT reduce `balance_remaining`. The `recalculate_balance` function *would* catch this since it sums `down_payment`-type payments, but normal flow never calls it — so `balance_remaining` is always overstated by the down payment amount.
- **Fix:** Set `balance = total_payable - inst.down_payment` when initializing the account, or call `recalculate_balance` after recording the down payment.

### CRIT-04 · `restore_database` doesn't replace the live connection
- [ ] **Fixed**
- **Category:** Business Logic
- **File:** `src-tauri/src/commands/db.rs:40-64`
- **Description:** After `fs::copy`, the `conn` held by `DbState(Mutex<Connection>)` still points to the old file descriptor. SQLite WAL connections cache pages in memory. The restored data won't be visible until the app restarts, but no forced exit happens. Users may read stale/corrupted data.
- **Fix:** Either force `app.exit(0)` programmatically after restore, or close and reopen the connection by replacing the `Mutex` content.

### CRIT-05 · Global `Mutex<Connection>` serializes all threads — UI freezes
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src-tauri/src/db/connection.rs:8`
- **Description:** Every Tauri command locks a single `Mutex` for the entire operation. Long-running report queries (aging report iterates all accounts, dashboard runs ~8 queries) block all other commands. With WAL mode, SQLite supports concurrent readers, but `Mutex<Connection>` serializes everything.
- **Impact:** UI freezes during report generation or dashboard load on large datasets.
- **Fix:** Use `r2d2_sqlite` connection pool, or at minimum use `RwLock` with separate read-only connections for query-only commands.

### CRIT-06 · Type mirror mismatch: `stock_qty` vs `stock_quantity` (inventory reports broken)
- [ ] **Fixed**
- **Category:** Type Safety
- **Files:** `src/types/report.ts:113` vs `src-tauri/src/models/report.rs:65`
- **Description:** TypeScript uses `stock_qty` but Rust serializes `stock_quantity`. The field will always be `undefined` at runtime — inventory reports silently show zero/missing stock quantities.
- **Fix:** Rename TS field to `stock_quantity` to match Rust serde output.

### CRIT-07 · Type mirror mismatch: `ExportProduct.stock_qty` vs `stock_quantity` (exports broken)
- [ ] **Fixed**
- **Category:** Type Safety
- **Files:** `src/types/import-export.ts:57` vs `src-tauri/src/models/import_export.rs:63`
- **Description:** Same naming mismatch as CRIT-06. Excel/CSV exports will have blank stock columns.
- **Fix:** Rename TS field to `stock_quantity`.

### CRIT-08 · Type mirror mismatch: `CreateInstallmentPayload.has_schedule` doesn't exist in Rust
- [ ] **Fixed**
- **Category:** Type Safety
- **Files:** `src/types/sale.ts:49-56` vs `src-tauri/src/models/sale.rs:70-77`
- **Description:** TS defines `has_schedule: boolean` on `CreateInstallmentPayload`, but the Rust struct does not have this field. Serde silently ignores it. The Zod schema validates it too. Either the Rust side was supposed to accept it (missing-field bug) or it's misleading dead data.
- **Fix:** Either add `has_schedule: bool` to the Rust struct, or remove it from TS payload and Zod validation. Determine intended behavior and align both sides.

### CRIT-09 · Audit log written inside transaction before COMMIT
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src-tauri/src/commands/sales.rs:354-364`
- **Description:** `insert_audit` writes to the DB inside the still-open transaction. If COMMIT then fails, the audit entry is rolled back — but the function returns `Err`, so the caller thinks the sale failed. Same pattern in `void_sale` (line 443-446) and `record_payment` (line 273-278).
- **Fix:** Move `insert_audit` to after COMMIT succeeds, or use rusqlite's `Transaction` RAII API.

### CRIT-10 · NotificationBell uses potentially unsupported `render` prop on PopoverTrigger
- [ ] **Fixed**
- **Category:** UI/UX
- **File:** `src/components/NotificationBell.tsx:53-67`
- **Description:** `<PopoverTrigger render={<button>…</button>}>` — if the component library version doesn't support the `render` prop, the bell button is either un-clickable or renders incorrectly.
- **Fix:** Test the component. If broken, convert to `<PopoverTrigger asChild><button>…</button></PopoverTrigger>`.

---

## 🟠 High Severity Issues

### HIGH-01 · `void_sale` stock restoration crashes on multi-item sales for same variant
- [ ] **Fixed**
- **Category:** Business Logic
- **File:** `src-tauri/src/commands/sales.rs:404-408`
- **Description:** If a sale has multiple line items for the same variant (e.g., 2 separate rows for variant 5), the subquery `SELECT si.quantity` returns multiple rows, causing an SQLite error: "subquery returns more than 1 row".
- **Fix:** Change to `SELECT SUM(si.quantity) FROM sale_items si WHERE ...`.

### HIGH-02 · Penalty compounds on `balance_remaining` which includes previous penalties (spiral)
- [ ] **Fixed**
- **Category:** Business Logic
- **File:** `src-tauri/src/services/penalty.rs:91`
- **Description:** `balance` already includes past penalties. Each new penalty is calculated on principal + interest + all prior penalties, creating compound growth. On long-overdue accounts, penalties snowball rapidly.
- **Fix:** Calculate penalty on the original principal or on `balance minus accumulated penalties`. Document the intended behavior explicitly.

### HIGH-03 · `void_sale` hard-deletes installment data (violates soft-delete spec)
- [ ] **Fixed**
- **Category:** Database
- **File:** `src-tauri/src/commands/sales.rs:412-431`
- **Description:** The spec says "never delete rows", but `void_sale` issues `DELETE FROM payment_schedules`, `DELETE FROM payments`, `DELETE FROM installment_accounts`. This destroys the audit trail.
- **Fix:** Soft-delete with status changes instead (e.g., `status = 'voided'`), or update the spec to reflect this design decision.

### HIGH-04 · `backup_database` / `restore_database` accept arbitrary file paths
- [ ] **Fixed**
- **Category:** Security
- **File:** `src-tauri/src/commands/db.rs:16,40`
- **Description:** `dest_path` and `src_path` are user-supplied strings with no sanitization. A modified IPC call could write to/read from any file on the filesystem.
- **Fix:** Validate paths are within an allowed directory (e.g., user's documents folder). Reject paths containing `..`, or use only file-picker dialog results.

### HIGH-05 · `export_all_data` acquires lock 6+ times — not atomic
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src-tauri/src/commands/import_export.rs:236-276`
- **Description:** Each sub-call locks/unlocks the mutex. Data can change between calls, producing inconsistent exports (e.g., a sale referencing a customer that was modified mid-export).
- **Fix:** Query all data within a single lock, or wrap in a read transaction.

### HIGH-06 · `useAccounts.fetchAccounts` reads stale `store.page` / `store.pageSize` via closure
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src/hooks/useAccounts.ts:14-40`
- **Description:** `fetchAccounts` destructures `store` but uses `store.page`/`store.pageSize` which are captured from the closure, not the latest store value.
- **Fix:** Use `useAccountStore.getState()` inside the callback body, or destructure individual values like the customer/product hooks do.

### HIGH-07 · Same stale-closure issue in `usePayments.fetchPayments`
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src/hooks/usePayments.ts:14-39`
- **Description:** Same pattern as HIGH-06.
- **Fix:** Align with the pattern used in `useCustomers`/`useSales`.

### HIGH-08 · `useReports` — all async functions recreated every render (no `useCallback`)
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src/hooks/useReports.ts:11-80`
- **Description:** All 6 report-fetching functions are plain `async` functions, not wrapped in `useCallback`. Every render creates new function references, breaking `useEffect` dependency arrays in report tabs.
- **Fix:** Wrap each function in `useCallback(…, [])`.

### HIGH-09 · `useCategories` mutation functions not wrapped in `useCallback`
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src/hooks/useCategories.ts:24-39`
- **Description:** `createCategory`, `updateCategory`, `deleteCategory` are recreated every render.
- **Fix:** Wrap in `useCallback`.

### HIGH-10 · `useProducts` — 8 mutation functions not wrapped in `useCallback`
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src/hooks/useProducts.ts:41-91`
- **Description:** `createProduct`, `updateProduct`, `archiveProduct`, `restoreProduct`, `createVariant`, `updateVariant`, `archiveVariant`, `adjustStock` are all plain async functions.
- **Fix:** Wrap each in `useCallback`.

### HIGH-11 · `invoke` wrapper `cmd` parameter is untyped `string`
- [ ] **Fixed**
- **Category:** Type Safety
- **File:** `src/lib/invoke.ts:45`
- **Description:** `invoke<T>(cmd: string, ...)` — the `ALLOWED_COMMANDS` set is defined `as const`, but `cmd` accepts any string. TypeScript won't catch typos in command names at compile time.
- **Fix:** Extract a union type from `ALLOWED_COMMANDS` and type the `cmd` parameter as that union.

### HIGH-12 · Report tab useEffects have missing dependencies
- [ ] **Fixed**
- **Category:** Code Quality
- **Files:** `SalesSummaryTab.tsx:46`, `ProfitLossTab.tsx:42`, `CollectionsTab.tsx`, `ReceivablesTab.tsx`, etc.
- **Description:** `useEffect(() => { getSalesSummary(…) }, [dateFrom, dateTo])` — the function `getSalesSummary` is missing from the dep array, causing stale closures.
- **Fix:** Add the hook function to the dependency array, or wrap upstream in `useCallback` (see HIGH-08).

### HIGH-13 · PaymentsPage `loadPayments` has misleading dependency array
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src/pages/payments/PaymentsPage.tsx:64`
- **Description:** `useCallback` deps include `page, pageSize` but the callback doesn't use them — misleading deps, stale closure risk, redundant re-fetches.
- **Fix:** Remove `page, pageSize` from the dependency array unless actually passed to `fetchPayments`.

### HIGH-14 · InventoryPage is a 549-line god component
- [ ] **Fixed**
- **Category:** Code Quality / Maintainability
- **File:** `src/pages/inventory/InventoryPage.tsx`
- **Description:** All modals, table, filters, stock adjustment, and archive logic in a single file. Hard to maintain, causes unnecessary re-renders.
- **Fix:** Extract into `InventoryFilters`, `InventoryTable`, and separate modal components.

### HIGH-15 · ImportExportPage is a 775-line god component
- [ ] **Fixed**
- **Category:** Code Quality / Maintainability
- **File:** `src/pages/import-export/ImportExportPage.tsx`
- **Description:** Contains Export, Import, Preview, and Logs UI all in one file.
- **Fix:** Extract into `ExportSection`, `ImportSection`, `ImportLogsSection`.

### HIGH-16 · Duplicated `add_months_to_date` function
- [ ] **Fixed**
- **Category:** Code Quality
- **Files:** `src-tauri/src/commands/sales.rs:457-487` AND `src-tauri/src/commands/import_export.rs:773-786`
- **Description:** Two separate implementations of the same date math. Bug fixes must be applied in both places.
- **Fix:** Move to `utils/date.rs` as a shared function.

### HIGH-17 · Duplicated `days_in_month` / `civil_from_days` / `days_to_ymd` date utilities
- [ ] **Fixed**
- **Category:** Code Quality
- **Files:** `src-tauri/src/commands/import_export.rs:788-808` AND `src-tauri/src/utils/date.rs:63-89`
- **Description:** Identical civil-date algorithms in two places.
- **Fix:** Remove duplicates from `import_export.rs`, use `utils::date`.

### HIGH-18 · `formatPercent` is ambiguous — assumes decimal input but data stores whole numbers
- [ ] **Fixed**
- **Category:** Business Logic
- **File:** `src/lib/formatters.ts:26-28`
- **Description:** `formatPercent(0.05)` → `"5.00%"`. But `interest_rate`, `penalty_rate` are stored as whole numbers (e.g., `5` for 5%). If anyone calls `formatPercent(account.interest_rate)`, they'll see `"500.00%"`.
- **Fix:** Either rename to `formatDecimalAsPercent` or add `formatPercentWhole(value)` → `${value.toFixed(2)}%`. Audit all callers.

---

## 🟡 Medium Severity Issues

### MED-01 · Penalty cooldown SQL check is insufficient
- [ ] **Fixed**
- **Category:** Business Logic
- **File:** `src-tauri/src/services/penalty.rs:51`
- **Description:** SQL only checks `last_penalty_date < today`, meaning penalties can technically be applied every day. The Rust-side PENALTY_COOLDOWN_DAYS check (30 days) prevents this, but the SQL pre-filter returns too many rows.
- **Fix:** Change SQL to `ia.last_penalty_date IS NULL OR date(ia.last_penalty_date, '+30 days') <= ?1`.

### MED-02 · `import_balance_row` doesn't create `sale_items`
- [ ] **Fixed**
- **Category:** Business Logic
- **File:** `src-tauri/src/commands/import_export.rs:710-714`
- **Description:** A synthetic sale is created but no `sale_items` rows. Any query JOINing `sale_items` shows "Unknown Product" for imported accounts.
- **Fix:** Create a synthetic product/variant + sale_item, or handle the "no items" case in display queries.

### MED-03 · `matchesDateRange` uses string comparison for dates
- [ ] **Fixed**
- **Category:** Business Logic
- **File:** `src/lib/filterUtils.ts:22-31`
- **Description:** `dateStr < from` and `dateStr > to` use lexicographic string comparison. Works only for ISO `YYYY-MM-DD` format. No input validation.
- **Fix:** Add a comment documenting the ISO-only requirement, or use `Date` objects for safety.

### MED-04 · Massive 21-element tuple destructuring in `get_account_by_id`
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src-tauri/src/commands/accounts.rs:162-184`
- **Description:** Extremely brittle. Adding a column breaks all positional indices.
- **Fix:** Use a helper function that maps by column name (like `row_to_product` in products.rs).

### MED-05 · `create_product` doesn't validate payload
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src-tauri/src/commands/products.rs:285-296`
- **Description:** `create_category` validates name via `require_text`, but `create_product` passes `payload.name` directly without validation. Empty names aren't caught.
- **Fix:** Add `require_text("Product name", &payload.name, 200)?`.

### MED-06 · `update_settings_batch` is not atomic
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src-tauri/src/commands/settings.rs:44-58`
- **Description:** Each setting update is a separate execute. If one fails mid-batch, some settings are updated and others aren't.
- **Fix:** Wrap in a transaction.

### MED-07 · Dashboard runs 8+ sequential queries under one lock
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src-tauri/src/commands/dashboard.rs:10-209`
- **Description:** All 8 queries execute sequentially while holding the mutex lock, blocking all other commands.
- **Fix:** Combine into fewer queries where possible, or use a read-only connection.

### MED-08 · `get_products` without limit fetches ALL variants
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src-tauri/src/commands/products.rs:218-232`
- **Description:** Without pagination, fetches every variant in the database. Fine for small stores, degrades on 1000+ products.
- **Fix:** Migrate to always using the paginated path like other stores.

### MED-09 · `productStore` missing `totalCount` — loads everything client-side
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src/stores/productStore.ts`
- **Description:** Unlike every other store (customer, sale, account, payment) which use server-side pagination, `productStore` has no `totalCount`/`setTotalCount` and `useProducts` fetches with `limit: null`.
- **Fix:** Add `totalCount`/`setTotalCount` and migrate to paginated fetching.

### MED-10 · `Product.variants` is non-optional in Rust but optional in TypeScript
- [ ] **Fixed**
- **Category:** Type Safety
- **Files:** `src/types/product.ts:18` vs `src-tauri/src/models/product.rs:27-28`
- **Description:** Rust uses `#[serde(default)] pub variants: Vec<ProductVariant>` — always serializes as an array. TS marks it as `variants?: ProductVariant[]`, forcing unnecessary null checks.
- **Fix:** Change TS to `variants: ProductVariant[]` (non-optional).

### MED-11 · `SaleItem.cost_price_snapshot` optional in TS but required in Rust
- [ ] **Fixed**
- **Category:** Type Safety
- **Files:** `src/types/sale.ts:28` vs `src-tauri/src/models/sale.rs:27`
- **Description:** TS has `cost_price_snapshot?: number` but Rust has `pub cost_price_snapshot: f64` (non-optional).
- **Fix:** Make it `cost_price_snapshot: number` in TS.

### MED-12 · `Sale` in TS has `items?: SaleItem[]` but Rust `Sale` has no `items` field
- [ ] **Fixed**
- **Category:** Type Safety
- **Files:** `src/types/sale.ts:19` vs `src-tauri/src/models/sale.rs:4-16`
- **Description:** If items are never populated on the `Sale` model from Rust, the field will always be `undefined`. The separate `SaleDetail` struct properly contains `items`.
- **Fix:** Remove `items` from the TS `Sale` type. Use `SaleDetail` when items are needed.

### MED-13 · `interest.ts` defines its own `PaymentScheduleEntry` — duplicates `types/account.ts`
- [ ] **Fixed**
- **Category:** Maintainability
- **Files:** `src/lib/interest.ts:3-7` vs `src/types/account.ts:8-13`
- **Description:** Two different interfaces with the same name. `interest.ts` has `month_number` but no `id`, `account_id`, `status`. Confusing name collision.
- **Fix:** Rename the `interest.ts` version to `GeneratedScheduleEntry` or `ScheduleTemplate`.

### MED-14 · `default_down_payment_pct` defaults inconsistently: `30` vs `"20"`
- [ ] **Fixed**
- **Category:** Business Logic / Maintainability
- **Files:** `src/types/settings.ts:34` vs `src/stores/settingsStore.ts:9`
- **Description:** `parseSettings()` falls back to `30` when `parseFloat` fails, but the store default is `"20"`.
- **Fix:** Align fallback values: both should be the same number.

### MED-15 · `low_stock_threshold` has 3 different defaults: `5`, `"2"`, and `2`
- [ ] **Fixed**
- **Category:** Business Logic / Maintainability
- **Files:** `src/types/settings.ts:35`, `src/stores/settingsStore.ts:10`, `src/lib/constants.ts:13`
- **Description:** Three conflicting default values in different locations.
- **Fix:** Use `DEFAULT_LOW_STOCK_THRESHOLD` from constants everywhere.

### MED-16 · `settingsStore.updateSetting/updateSettingsBatch` have no error handling
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src/stores/settingsStore.ts:45-58`
- **Description:** Both do `await invoke(...)` without try/catch. If the backend call fails, the error bubbles up unhandled, inconsistent with the hook patterns.
- **Fix:** Add try/catch with `toast.error()` or document that callers must handle errors.

### MED-17 · Duplicate `PaginatedResult` type — `common.ts` appears to be dead code
- [ ] **Fixed**
- **Category:** Maintainability
- **Files:** `src/types/common.ts:22-25` vs `src/types/shared.ts:1-4`
- **Description:** `PaginatedResponse<T>` in `common.ts` and `PaginatedResult<T>` in `shared.ts` both exist. All hooks import from `shared.ts`. The `common.ts` types appear unused.
- **Fix:** Verify no imports exist, then delete `src/types/common.ts`.

### MED-18 · No index on `payments.type`
- [ ] **Fixed**
- **Category:** Database
- **File:** `src-tauri/src/db/migrations.rs`
- **Description:** `recalculate_balance` and collections report filter by `payments.type`, but there's no index on this column.
- **Fix:** Add `CREATE INDEX idx_payments_type ON payments(type)`.

### MED-19 · `product_variants.sku` UNIQUE allows empty strings
- [ ] **Fixed**
- **Category:** Database
- **File:** `src-tauri/src/db/migrations.rs:78`
- **Description:** `sku TEXT UNIQUE` — SQLite allows multiple NULLs (correct), but two variants with empty-string `""` SKUs would violate uniqueness. Import converts empty to `None`, but manual creation could send `""`.
- **Fix:** Add `CHECK(sku IS NULL OR length(sku) > 0)` constraint.

### MED-20 · Repeated data-fetching + loading/error pattern in all 7 report tabs
- [ ] **Fixed**
- **Category:** Code Quality (DRY)
- **Files:** `SalesSummaryTab`, `CollectionsTab`, `ReceivablesTab`, `ProfitLossTab`, `InventoryTab`, `CustomerHistoryTab`, `AgingTab`
- **Description:** Every tab repeats: `useState(null)`, `useState(loading)`, `useEffect`, `.then(setData).catch(toast).finally(setLoading(false))`.
- **Fix:** Create a `useReportData<T>(fetcher, deps)` hook that returns `{ data, loading, error }`.

### MED-21 · Inconsistent loading states across pages
- [ ] **Fixed**
- **Category:** UI/UX
- **Files:** Dashboard, CustomersPage, SettingsPage, AccountsPage
- **Description:** Dashboard uses `<Skeleton>` cards. CustomersPage shows "Loading…" text. AccountsPage uses `<TableSkeleton>`. No unified approach.
- **Fix:** Standardize: table pages → `TableSkeleton`; card pages → skeleton cards; detail pages → skeleton layout.

### MED-22 · Missing `aria-label` on icon-only buttons
- [ ] **Fixed**
- **Category:** UI/UX (Accessibility)
- **Files:** Most `DropdownMenuTrigger` buttons use `title=` but not `aria-label=`. All `⋯` action menus.
- **Description:** Screen readers rely on `aria-label`, not `title`.
- **Fix:** Add `aria-label` to all icon-only buttons.

### MED-23 · Sidebar missing "Sales History" link
- [ ] **Fixed**
- **Category:** UI/UX
- **File:** `src/app/layout/Sidebar.tsx:18-26`
- **Description:** Sidebar has "New Sale" but no "Sales History" link. Users must use the command palette or know the URL.
- **Fix:** Add `{ to: "/sales", label: "Sales History", icon: ReceiptText }` to `mainNav`.

### MED-24 · Dashboard skeleton layout is broken
- [ ] **Fixed**
- **Category:** UI/UX
- **File:** `src/pages/dashboard/DashboardPage.tsx:63-69`
- **Description:** Loading skeleton wraps 4 items in a grid inside a centering container. The grid has no width, so skeleton cards are tiny/collapsed.
- **Fix:** Give the skeleton grid `w-full` or use the same layout as the loaded state.

### MED-25 · Hardcoded colors in PaymentsPage instead of semantic variables
- [ ] **Fixed**
- **Category:** Styling
- **File:** `src/pages/payments/PaymentsPage.tsx:34-39`
- **Description:** `typeColor` map uses hardcoded Tailwind classes (`bg-green-100`, `text-green-800`, `dark:bg-green-900`) instead of semantic CSS variables or the `StatusBadge` component.
- **Fix:** Use `StatusBadge` component or semantic CSS variables.

### MED-26 · Inline `style={{ fontFamily: "var(--font-heading)" }}` repeated in 9+ components
- [ ] **Fixed**
- **Category:** Styling (DRY)
- **Files:** `TopBar.tsx`, `DashboardPage.tsx`, `KpiCard.tsx`, `PageHeader.tsx`, `ReportsPage.tsx`, `NotFoundPage.tsx`, `DatabaseBackupRestore.tsx`, `SalesSummaryTab.tsx`, `ProfitLossTab.tsx`
- **Description:** Heading font applied via inline `style=` in 9+ places. `globals.css` already has `h1-h6 { font-family: var(--font-heading) }`.
- **Fix:** Add a utility class `.font-heading { font-family: var(--font-heading) }` and use it, or just use semantic heading tags.

### MED-27 · CommandPalette search doesn't actually filter results
- [ ] **Fixed**
- **Category:** Feature
- **File:** `src/components/CommandPalette.tsx:46-60`
- **Description:** `filteredCustomers` and `filteredProducts` just `.filter(c => c.is_active).slice(0, 8)`. The `search` state is set but never used to filter results.
- **Fix:** Add `.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))`.

### MED-28 · No `beforeunload` guard on NewSalePage
- [ ] **Fixed**
- **Category:** Feature
- **File:** `src/pages/sales/NewSalePage.tsx`
- **Description:** If a user has items in the cart and navigates away, all cart data is lost with no warning. SettingsPage has this guard but NewSalePage doesn't.
- **Fix:** Add a `beforeunload` listener + `useBlocker` from react-router when cart has items.

### MED-29 · `ExportPayment.payment_type` typed as `PaymentType` union but Rust sends plain String
- [ ] **Fixed**
- **Category:** Type Safety
- **File:** `src/types/import-export.ts:109` vs `src-tauri/src/models/import_export.rs:120`
- **Description:** TS uses a strict union type but Rust sends an unvalidated `String`. Not compile-time safe if Rust ever sends an unexpected value.
- **Fix:** Document that the Rust side must only send valid enum values, or add runtime validation.

### MED-30 · `chrono` dependency barely used — hand-rolled date math used instead
- [ ] **Fixed**
- **Category:** Maintainability
- **Files:** `src-tauri/Cargo.toml:26`, `src-tauri/src/utils/date.rs`, `src-tauri/src/commands/import_export.rs`
- **Description:** chrono is a dependency but the codebase hand-rolls date math. chrono is only used in `reports.rs:560` for the aging report.
- **Fix:** Either use chrono consistently or remove it and use hand-rolled functions everywhere.

### MED-31 · Penalty cooldown `PENALTY_COOLDOWN_DAYS` defined but not used in SQL
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src-tauri/src/services/penalty.rs`
- **Description:** The constant exists in Rust but the SQL pre-filter doesn't use it, fetching more rows than necessary.
- **Fix:** Embed the cooldown in the SQL WHERE clause to reduce result set.

### MED-32 · No unsaved-changes guard on NewSalePage cart
- [ ] **Fixed**
- **Category:** Feature
- **File:** `src/pages/sales/NewSalePage.tsx`
- **Description:** Cart items are lost on navigation with no warning. SettingsPage has this guard but NewSalePage doesn't.
- **Fix:** Add `useBlocker` from react-router when `cartItems.length > 0`.

### MED-33 · `reports.rs` is 620 lines with 7 report functions
- [ ] **Fixed**
- **Category:** Maintainability
- **File:** `src-tauri/src/commands/reports.rs`
- **Description:** Large single file with many different report functions.
- **Fix:** Split into separate files per report category (e.g., `reports/sales.rs`, `reports/aging.rs`).

---

## 🟢 Low Severity Issues

### LOW-01 · `AuditEntry` type defined inline in hook, not in `src/types/`
- [ ] **Fixed**
- **Category:** Maintainability
- **File:** `src/hooks/useAuditLog.ts:7-14`
- **Description:** Violates the project convention of keeping types in `src/types/`.
- **Fix:** Move to `src/types/audit.ts`.

### LOW-02 · Badge variant keys don't match `StockStatus` type
- [ ] **Fixed**
- **Category:** Code Quality
- **Files:** `src/lib/badgeVariants.ts:43-47` vs `src/types/report.ts:5`
- **Description:** `StockStatus = "In Stock" | "Low Stock" | "Out of Stock"` but badge keys are `in_stock`, `low_stock`, `out_of_stock`. These will never match.
- **Fix:** Align the keys or normalize the status before lookup.

### LOW-03 · `collectionTypeVariant` keys don't match `PaymentRecordType` union
- [ ] **Fixed**
- **Category:** Code Quality
- **Files:** `src/lib/badgeVariants.ts:36-40` vs `src/types/payment.ts:1`
- **Description:** Badge variant keys `regular`/`advance` don't match the `PaymentRecordType` union (`payment`/`penalty`/`interest_adjustment`/`down_payment`). Lookup returns `undefined`.
- **Fix:** Update keys to match actual `PaymentRecordType` values.

### LOW-04 · Duplicate CSV export implementations
- [ ] **Fixed**
- **Category:** Maintainability
- **Files:** `src/lib/csv.ts` vs `src/lib/export/toCsv.ts`
- **Description:** Two independent CSV export implementations. Both include BOM prefix and `escapeCsv`.
- **Fix:** Consolidate. Audit usage and remove the unused one.

### LOW-05 · `useClientPagination` duplicates `DEFAULT_PAGE_SIZE` from constants
- [ ] **Fixed**
- **Category:** Maintainability
- **File:** `src/hooks/useClientPagination.ts:3` vs `src/lib/constants.ts:7`
- **Description:** Both define `DEFAULT_PAGE_SIZE = 10`.
- **Fix:** Import from `@/lib/constants`.

### LOW-06 · `AppSettings` index signature `[key: string]: string` weakens type safety
- [ ] **Fixed**
- **Category:** Type Safety
- **File:** `src/types/settings.ts:13`
- **Description:** The index signature allows any arbitrary key, defeating the purpose of explicit fields. Needed for `updateSettingsBatch` but weakens type checking elsewhere.
- **Fix:** Use a `Record<string, string>` for the raw map and a strict `AppSettings` without the index signature.

### LOW-07 · `TypedSettings` includes `receipt_footer` but store defaults don't
- [ ] **Fixed**
- **Category:** Maintainability
- **Files:** `src/types/settings.ts:25,38` vs `src/stores/settingsStore.ts:5-16`
- **Description:** `TypedSettings` has `receipt_footer: string` but `AppSettings` and `defaultSettings` don't define it.
- **Fix:** Add `receipt_footer: ""` to `defaultSettings`.

### LOW-08 · Inconsistent error mapping — `map_err(|e| e.to_string())` everywhere in Rust
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** Entire Rust codebase
- **Description:** Every function uses `.map_err(|e| e.to_string())`. Boilerplate that could be reduced.
- **Fix:** Create a custom error type or macro.

### LOW-09 · `println!` used for logging instead of proper log crate
- [ ] **Fixed**
- **Category:** Code Quality
- **Files:** `src-tauri/src/db/connection.rs:40`, `migrations.rs:218,241,256` etc.
- **Fix:** Use the `log` or `tracing` crate for proper log levels.

### LOW-10 · All dates are UTC but Philippines is UTC+8
- [ ] **Fixed**
- **Category:** Code Quality
- **Files:** `src-tauri/src/utils/date.rs`, `services/penalty.rs`
- **Description:** `today_iso()` returns UTC. Near midnight, "today" may differ from the user's actual Philippine date. Penalty detection and scheduling could be off by a day.
- **Fix:** Consider using local time for business dates.

### LOW-11 · `#[allow(dead_code)]` on `CustomerBasic`
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src-tauri/src/models/customer.rs:20`
- **Description:** If it's dead code, remove it. If planned for future use, add a TODO.
- **Fix:** Remove or add a TODO comment.

### LOW-12 · `create_sale` uses manual `BEGIN/COMMIT/ROLLBACK` instead of rusqlite Transaction API
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src-tauri/src/commands/sales.rs`
- **Description:** Manual transaction management is error-prone. rusqlite's `Transaction` API provides RAII-based safety.
- **Fix:** Use `let tx = conn.transaction()?; ... tx.commit()?`.

### LOW-13 · TopBar re-renders every minute due to clock
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src/app/layout/TopBar.tsx:37-41`
- **Description:** `setInterval(() => setNow(new Date()), 60_000)` causes the entire TopBar to re-render.
- **Fix:** Extract the clock into a tiny `<Clock />` component.

### LOW-14 · Customers table `useMemo` dependency might not be referentially stable
- [ ] **Fixed**
- **Category:** Performance
- **File:** `src/pages/customers/CustomersPage.tsx:82`
- **Description:** `useMemo(() => filteredCustomers(), [rawCustomers, filters])` — `filters` is an object reference from the store. If referential stability isn't guaranteed, the memo is useless.
- **Fix:** Spread individual filter values in the dep array.

### LOW-15 · KpiCard accepts dual props for the same purpose (`title`/`label`, `sub`/`description`)
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src/components/KpiCard.tsx:9-10, 47-48`
- **Description:** Confusing API with duplicate props.
- **Fix:** Deprecate one pair. Standardize on `label` + `description`.

### LOW-16 · No dark-mode scrollbar styles
- [ ] **Fixed**
- **Category:** Styling
- **File:** `src/styles/globals.css:204-224`
- **Description:** Scrollbar uses hardcoded `#CBD5E1` (light-mode slate) — jarring in dark mode.
- **Fix:** Use CSS variables: `scrollbar-color: var(--muted-foreground) transparent`.

### LOW-17 · DatePicker uses US format `MM/dd/yyyy`, not Philippine convention
- [ ] **Fixed**
- **Category:** UI/UX
- **File:** `src/components/DatePicker.tsx:46`
- **Description:** Philippines convention is `dd/MM/yyyy` or `MMMM d, yyyy`.
- **Fix:** Use a locale-appropriate format.

### LOW-18 · `useCurrency()` hook destructured identically in 20+ files
- [ ] **Fixed**
- **Category:** Code Quality (DRY)
- **Files:** 20+ files all use `const { format: formatCurrency } = useCurrency()`
- **Description:** The rename-on-destructure is boilerplate everywhere.
- **Fix:** Have the hook export `formatCurrency` directly.

### LOW-19 · `format!` used where not needed in customers.rs
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src-tauri/src/commands/customers.rs:342`
- **Description:** `sets.push(format!("updated_at = datetime('now')"))` — unnecessary `format!` macro.
- **Fix:** Use `"updated_at = datetime('now')".to_string()`.

### LOW-20 · Settings key/value has no validation
- [ ] **Fixed**
- **Category:** Security
- **File:** `src-tauri/src/commands/settings.rs:28-41`
- **Description:** Any key/value can be written. Not a real security issue for a local app, but could corrupt configuration.
- **Fix:** Validate against an allow-list of known setting keys.

### LOW-21 · No keyboard shortcut for Dashboard refresh
- [ ] **Fixed**
- **Category:** Feature
- **File:** `src/pages/dashboard/DashboardPage.tsx`
- **Description:** Consider `F5` or `Ctrl+Shift+R` for dashboard refresh.

### LOW-22 · `Toaster` placed outside `ErrorBoundary` (intentional but undocumented)
- [ ] **Fixed**
- **Category:** Code Quality
- **File:** `src/App.tsx:17`
- **Description:** If an error boundary triggers, toasts still render (correct behavior). Just undocumented.
- **Fix:** Add a comment explaining this is intentional.

---

## ✅ What's Done Well

These are areas where the codebase demonstrates strong practices:

| Area | Details |
|------|---------|
| **Route lazy loading** | All page routes use `lazy()` with `Suspense` fallbacks |
| **Error boundaries** | Per-route + global error boundary with recovery UI |
| **Design system** | Consistent CSS variables, chart theme, semantic color tokens |
| **Keyboard shortcuts** | `Ctrl+K` palette, `Ctrl+N` new sale, `?` for keyboard help |
| **Empty states** | Reusable `EmptyState` component used consistently |
| **Skeleton loading** | `TableSkeleton` reusable component |
| **Status badges** | Centralized `StatusBadge` + `badgeVariants.ts` |
| **Form validation** | Zod schemas + React Hook Form throughout |
| **Receipt generation** | Print-friendly receipt layout |
| **Data export** | Excel/PDF/CSV export on reports |
| **Dark mode** | Full light/dark/system theme support |
| **Sidebar** | Collapsible sidebar with keyboard toggle |
| **SQL injection protection** | All Rust queries use parameterized bindings |
| **Soft deletes** | Products and customers use `is_active` flags |
| **Foreign keys** | `PRAGMA foreign_keys=ON` enforced |
| **WAL mode** | `PRAGMA journal_mode=WAL` for performance |
| **Audit logging** | Sales, payments, and voids are audit-logged |
| **Typed IPC wrapper** | `invoke.ts` with allowed command whitelist |
| **Project structure** | Clean separation: commands → services → models |
| **Type mirroring** | Most TS types accurately mirror Rust models |

---

## Implementation Priority

### Phase 1 — Critical Fixes (Money & Data Integrity)
- [ ] CRIT-01: Fix interest calculation formula
- [ ] CRIT-02: Fix `recalculate_balance` to include interest
- [ ] CRIT-03: Fix down payment not reducing `balance_remaining`
- [ ] HIGH-01: Fix `void_sale` stock restoration for multi-item sales
- [ ] HIGH-02: Fix penalty compound spiral
- [ ] HIGH-03: Fix `void_sale` hard-deleting installment data
- [ ] HIGH-18: Fix `formatPercent` ambiguity

### Phase 2 — Security & Stability
- [ ] CRIT-04: Fix `restore_database` stale connection
- [ ] CRIT-05: Replace `Mutex<Connection>` with connection pool or RwLock
- [ ] CRIT-09: Fix audit log transaction ordering
- [ ] HIGH-04: Validate backup/restore file paths
- [ ] HIGH-05: Make `export_all_data` atomic

### Phase 3 — Type Safety & Data Correctness
- [ ] CRIT-06: Fix `stock_qty` → `stock_quantity` in report types
- [ ] CRIT-07: Fix `stock_qty` → `stock_quantity` in export types
- [ ] CRIT-08: Resolve `has_schedule` mismatch
- [ ] HIGH-11: Type the `invoke` cmd parameter as union
- [ ] MED-10 through MED-12: Fix remaining type mismatches

### Phase 4 — Performance & Code Quality
- [ ] HIGH-08 through HIGH-10: Wrap hook functions in `useCallback`
- [ ] HIGH-06, HIGH-07: Fix stale closure issues in hooks
- [ ] HIGH-12, HIGH-13: Fix useEffect dependency arrays
- [ ] HIGH-16, HIGH-17: Deduplicate Rust date utilities
- [ ] MED-07: Optimize dashboard queries
- [ ] MED-08, MED-09: Implement server-side product pagination

### Phase 5 — UI/UX & Styling Polish
- [ ] CRIT-10: Fix NotificationBell render prop
- [ ] MED-21: Standardize loading states
- [ ] MED-22: Add aria-labels for accessibility
- [ ] MED-23: Add Sales History to sidebar
- [ ] MED-24: Fix dashboard skeleton layout
- [ ] MED-25, MED-26: Eliminate hardcoded colors and inline font styles
- [ ] MED-27: Fix CommandPalette search filtering
- [ ] MED-28: Add unsaved-changes guard on NewSalePage

### Phase 6 — Maintainability & Cleanup
- [ ] HIGH-14, HIGH-15: Decompose god components
- [ ] MED-20: Create `useReportData` hook
- [ ] MED-17: Remove dead `common.ts` types
- [ ] MED-13: Rename duplicate `PaymentScheduleEntry`
- [ ] MED-14, MED-15: Align settings defaults
- [ ] LOW-01 through LOW-22: Address remaining low-severity items
