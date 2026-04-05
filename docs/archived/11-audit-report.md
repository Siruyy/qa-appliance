# Quality Appliance — Comprehensive Codebase Audit

> **Status:** Audit complete — see `docs/12-implementation-plan.md` for the remediation roadmap.
>
> Covers all 7 completed phases. Issues are rated **Critical**, **High**, **Medium**, or **Low**.

---

## Table of Contents

1. [Code Quality & DRY](#1-code-quality--dry)
2. [Security](#2-security)
3. [Performance & Optimization](#3-performance--optimization)
4. [Business Logic](#4-business-logic)
5. [Feature Completeness & UX](#5-feature-completeness--ux)
6. [Styling, Layout & Theming](#6-styling-layout--theming)
7. [Maintainability & Readability](#7-maintainability--readability)

---

## 1. Code Quality & DRY

### 1.1 — Duplicated `KpiCard` component **[High]**

`src/pages/dashboard/DashboardPage.tsx` defines a local `KpiCard` function component:

```tsx
function KpiCard({ title, value, sub, alert }) { … }
```

`src/pages/reports/KpiCard.tsx` defines a separate but slightly different `KpiCard`:

```tsx
export function KpiCard({ label, value, type }) { … }
```

These have divergent prop APIs. There should be **one** `src/components/KpiCard.tsx` that both pages consume.

---

### 1.2 — `invoke` helper inconsistently used **[Medium]**

`src/lib/invoke.ts` exports a typed wrapper around `@tauri-apps/api/core` invoke with error logging. However, across the codebase files mix two patterns:

| Pattern | Files |
|---------|-------|
| `import { invoke } from "@tauri-apps/api/core"` | `settingsStore.ts`, `AppShell.tsx`, `useDashboard.ts` |
| `import { invoke } from "@/lib/invoke"` | (intended pattern, rarely used) |

The helper's `console.error` logging in development is also inappropriate for a production build.

---

### 1.3 — `uiStore` `sidebarCollapsed` is dead state **[Medium]**

`src/stores/uiStore.ts` defines `sidebarCollapsed` and `toggleSidebar`. The `Sidebar` component never reads or calls these — the sidebar cannot actually collapse. Either wire it up or remove the dead state.

---

### 1.4 — `DashboardStats` dead type in `report.ts` **[Low]**

`src/types/report.ts` contains a `DashboardStats` interface that was superseded in Phase 7 by `DashboardData`. This orphaned type adds noise without purpose.

---

### 1.5 — Page header duplication **[Medium]**

`TopBar.tsx` already renders the page title. Yet several pages also render their own `<h1>` headers:

- `SalesHistoryPage`: Has `<h1>Sales History</h1>`
- `AccountsPage`: Has `<h1>Accounts / Receivables</h1>`
- `CustomersPage`: Has `<h1>Customers</h1>`
- `AccountDetailPage`: Has a contextual `<h1>` (appropriate — dynamic title)

`InventoryPage` inconsistently skips the h1 and shows only a description paragraph.

A shared `PageHeader` component should standardize this, and the static page h1s should be removed to avoid the TopBar+h1 double-title issue.

---

### 1.6 — `defaultInstallment` hardcodes settings values **[High]**

In `NewSalePage.tsx`:

```tsx
const defaultInstallment: CreateInstallmentPayload = {
  down_payment: 0,
  interest_rate: 0,   // ← should come from settings.default_interest_rate
  penalty_rate: 5,    // ← should come from settings.default_penalty_rate
  term_months: 6,     // ← should come from settings.default_term_months
  …
};
```

The user can configure defaults in Settings but they're never applied to the New Sale form.

---

### 1.7 — `filteredSales()` does not apply date filters **[High]**

`saleStore.filteredSales()` applies `search` and `paymentType` client-side but ignores `dateFrom`/`dateTo` entirely. Those filters are passed to the server only via `fetchSales()`. The "Clear filters" button resets state but doesn't trigger a refetch, leaving stale data visible.

---

### 1.8 — `DropdownMenuTrigger` raw `className` instead of `asChild` **[Low]**

In multiple pages, `DropdownMenuTrigger` uses a raw `className` without the Radix `asChild` prop, resulting in button-inside-button accessibility violations:

```tsx
<DropdownMenuTrigger className="inline-flex …">
```

Should be:

```tsx
<DropdownMenuTrigger asChild>
  <Button variant="ghost" size="icon">…</Button>
</DropdownMenuTrigger>
```

---

## 2. Security

### 2.1 — `console.error` leaks internal errors in production **[Medium]**

Multiple locations emit raw error details to the browser console:

- `src/lib/invoke.ts`: `console.error(\`[invoke] ${cmd} failed:\`, error)`
- `src/app/layout/AppShell.tsx`: `console.error("Penalty check failed:", err)`

In production Tauri builds, the DevTools are typically disabled, so these don't expose info to end users. However, in dev mode these leak Rust panic messages and internal DB errors. All `console.error` calls should be gated behind a `DEV` environment check or removed in favor of toast notifications.

---

### 2.2 — SQL built by string concatenation (style risk) **[Medium]**

Several Rust commands build SQL with `format!()` to assemble `WHERE` clauses:

```rust
let sql = format!("SELECT … {} ORDER BY …", where_clause);
```

While all user-supplied values are still passed via `params` (not interpolated directly), this pattern is fragile — a future developer might accidentally interpolate a param directly. The pattern should be documented with a comment or replaced with a query builder.

---

### 2.3 — No input length validation on free-text fields **[Low]**

Frontend Zod schemas for customer `name`, `notes`, product names, etc., have no `max()` length constraint. SQLite will accept any length, but very long strings can break layout and are a minor data quality concern.

---

### 2.4 — Import file validation is calamine-only **[Low]**

The import command validates file extension server-side before passing to calamine, but no max file size check exists. A maliciously large XLSX could cause high memory usage. A file size cap should be applied in the Rust command before attempting to parse.

---

## 3. Performance & Optimization

### 3.1 — No pagination on any table **[High]**

Every list in the app loads **all records** into memory at once:

| Page | Risk |
|------|------|
| Inventory | All products + variants |
| Customers | All customers |
| Sales History | All sales |
| Accounts | All accounts |
| Payments | All payments |

For a store with hundreds of products and years of sales, this will cause visible load delays and high memory use. Server-side pagination (limit/offset) should be added to all list commands.

---

### 3.2 — `loadSettings` called twice on dashboard and settings pages **[Medium]**

`AppShell.tsx` calls `loadSettings()` on every mount via `useEffect`. `DashboardPage.tsx` also calls `loadSettings()` in its own `useEffect`, resulting in two concurrent IPC calls on the first render of the dashboard. `SettingsPage.tsx` also calls `loadSettings()` on mount.

Settings should be loaded once from `AppShell` and made available reactively to all consumers via the Zustand store — pages should read from store state, not trigger their own loads.

---

### 3.3 — Dashboard 8 separate SQL queries on startup **[Medium]**

`get_dashboard_data` in `commands/dashboard.rs` fires 8 sequential SQL queries under a single Mutex lock. While each query is fast individually, holding the lock for the full duration of all 8 queries blocks any concurrent DB access. These should be wrapped in a single transaction or structured as a single CTE query where possible.

---

### 3.4 — `filteredProducts()` / `filteredSales()` / `filteredCustomers()` not memoized **[Medium]**

These are Zustand store methods called as `store.filteredProducts()` — they execute a full `Array.filter()` on every render. They should use `useMemo` at the call site or be computed via Zustand's `computed` pattern to avoid re-running on every render cycle.

---

### 3.5 — Recharts charts have no memoization **[Low]**

The `LineChart` and `BarChart` in `DashboardPage.tsx` re-render on every state change (loading, data fetches). Wrapping the chart components in `React.memo` and using stable data references would avoid unnecessary repaints.

---

## 4. Business Logic

### 4.1 — `formatCurrency` ignores settings `currency_symbol` **[High]**

`src/lib/formatters.ts` hardcodes `en-PH` locale and `PHP` currency:

```ts
new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })
```

The settings table has a `currency_symbol` key (default `₱`). If a user changes this setting, formatted values throughout the app will still show `₱ ` from the `Intl` formatter. The formatter should accept an optional symbol parameter or read from the settings store.

---

### 4.2 — Profit & Loss uses live `cost_price`, not historical **[Critical]**

`reports.rs` `get_profit_loss_report` joins `sale_items` to `product_variants` to get `cost_price`:

```sql
SELECT si.quantity * v.cost_price AS cost …
FROM sale_items si
JOIN product_variants v ON v.id = si.variant_id
```

If the cost price of a variant is updated after a sale, historical P&L reports will show the **wrong** cost and therefore wrong profit margins. The `sale_items` table does not store `cost_price` at time of sale.

**Fix:** Add a `cost_price_snapshot REAL` column to `sale_items` (migration V3) and capture it at point of sale.

---

### 4.3 — New Sale form ignores settings defaults **[High]**

`defaultInstallment` in `NewSalePage.tsx` hardcodes:
- `interest_rate: 0` — should read `settings.default_interest_rate`
- `penalty_rate: 5` — should read `settings.default_penalty_rate`
- `term_months: 6` — should read `settings.default_term_months`
- `down_payment: 0` — should derive from `settings.default_down_payment_pct` × cart total

The entire purpose of the Settings page for these defaults is broken.

---

### 4.4 — `preset_terms` setting not used in New Sale form **[Medium]**

`settings.preset_terms` (default `"3,6,12,18,24"`) is stored and editable in SettingsPage. The `InstallmentConfigPanel` in `NewSalePage` provides a free-form number input for term months. It should render the preset terms as quick-select buttons to speed up entry.

---

### 4.5 — Payment `type` field partially implemented **[Medium]**

The `payments` table allows types: `payment`, `penalty`, `interest_adjustment`, `down_payment`. Penalty records are written with type `'penalty'` but down payments at sale creation (`create_sale`) write with type `'down_payment'` (correct). However, `interest_adjustment` is never used. The payment history UI in `PaymentHistoryTable` doesn't differentiate between payment types visually — all show the same badge regardless of type.

---

### 4.6 — No sale editing — only void and re-create **[Medium]**

Once a sale is created, there is no way to correct mistakes short of voiding and re-creating it. For a business app, minor corrections (wrong quantity, wrong customer assignment, discount adjustment) should be possible without a full void, which also restores stock and creates a confusing audit trail.

---

### 4.7 — Penalty check uses `chrono_today()` but no chrono dependency **[Low]**

`src-tauri/src/services/penalty.rs` calls a local `chrono_today()` helper (defined in the same file). The main `commands/dashboard.rs` reimplements the same UTC date logic via `civil_from_days`. These two date-today implementations should be unified into a single `src-tauri/src/utils/date.rs` module.

---

## 5. Feature Completeness & UX

### 5.1 — No light/dark mode **[High]**

`globals.css` defines a single `:root` color palette (light theme). The `@custom-variant dark (&:is(.dark *))` directive is declared but no `.dark` class token overrides exist. The app is locked to the light theme. Light/dark mode toggle is a standard enterprise app requirement.

---

### 5.2 — Payments page has no search or filter **[High]**

`PaymentsPage` (if it exists) or the payments list shows all payment records with no filtering by customer, date range, or account. For a store with years of transaction history this is unusable.

---

### 5.3 — No print / receipt functionality **[High]**

There is no way to print:
- A sale receipt (for customers)
- A payment confirmation (for installment/utang customers)
- An account summary

This is critical for a physical appliance store.

---

### 5.4 — Sidebar collapse not wired up **[Medium]**

`uiStore.sidebarCollapsed` exists but `Sidebar.tsx` doesn't use it. The sidebar is permanently 60px wide. Adding a collapse button would give more horizontal real estate for data-heavy tables.

---

### 5.5 — Customer list missing balance summary **[Medium]**

The Customers list shows name, phone, and address — but not total outstanding balance across all linked installment accounts. This is critical information for a collections-focused business.

---

### 5.6 — No keyboard shortcut help overlay **[Low]**

`Ctrl+N` (new sale) and `Ctrl+,` (settings) are implemented but undiscoverable. A `?` key or help button should display the shortcut map.

---

### 5.7 — `SalesHistoryPage` date filters don't auto-refetch **[Medium]**

Changing `dateFrom`/`dateTo` in `SalesHistoryPage` updates store state but doesn't trigger a server refetch. The user must change the "Show voided" checkbox to trigger a fetch. Date filter changes should trigger `fetchSales()`.

---

### 5.8 — No account balance recalculation trigger from UI **[Low]**

`recalculate_balance` command exists in Rust but is not exposed in the UI. If data integrity issues arise (e.g., after a void), there's no way for the user to trigger a recalculation without developer access.

---

## 6. Styling, Layout & Theming

### 6.1 — Light/dark mode absent **[High]**

As noted in §5.1. The `:root` block defines only light-mode values. A `html.dark :root` or `.dark` override block needs to be added defining dark equivalents of all color tokens.

---

### 6.2 — `text-warning` and `bg-warning` classes undefined **[High]**

In `InventoryPage.tsx` (VariantRow):

```tsx
<Badge className="bg-warning text-warning-foreground">Low Stock</Badge>
```

`bg-warning` is not a standard Tailwind class. While `--color-warning` is defined in `:root` CSS, Tailwind v4's `@theme inline` block does not include a `--color-warning-foreground` mapping. This will render as unstyled text.

---

### 6.3 — Inconsistent page header pattern **[Medium]**

| Page | TopBar title | Inline h1 | Description para |
|------|-------------|-----------|-----------------|
| Dashboard | ✓ | ✗ | ✗ |
| Inventory | ✓ | ✗ | ✓ (description only) |
| Customers | ✓ | ✓ | ✓ |
| Sales History | ✓ | ✓ | ✓ |
| Accounts | ✓ | ✓ | ✓ |
| Account Detail | ✓ | ✓ (dynamic) | ✓ |
| Reports | ✓ | ✗ | ✗ |
| Settings | ✓ | ✗ | ✗ |

A `PageHeader` component with `title` and optional `description` + action slot would unify this.

---

### 6.4 — TopBar hardcodes `bg-white` **[Medium]**

`TopBar.tsx`:

```tsx
<header className="… bg-white …">
```

This hardcoded value will break in dark mode. It should use `bg-background` or `bg-card`.

---

### 6.5 — Inconsistent table row hover state **[Low]**

Some tables use `hover:bg-muted/50`, others `hover:bg-accent`, and some have no hover at all. Standardize on `hover:bg-muted/50` for all data table rows.

---

### 6.6 — No loading skeleton components **[Medium]**

Loading states are pure text strings (`"Loading products…"`, `"Loading accounts..."`, `"Loading…"`). For an enterprise app, skeleton/shimmer placeholders provide a much better perceived performance experience.

---

### 6.7 — No empty state illustrations **[Low]**

Empty states vary — some use a centered icon (Inventory uses `<Package>`), others use plain text. A shared `EmptyState` component with consistent icon + message + optional CTA button would unify this.

---

### 6.8 — Spacing inconsistency across pages **[Medium]**

- Most pages use `space-y-6` as the root spacing
- `DashboardPage` uses a mix of `space-y-6` and manual `mt-6`
- `AccountDetailPage` uses `space-y-6` consistently

The root page wrapper should be a shared `<Page>` layout component that standardizes padding, max-width, and vertical rhythm.

---

### 6.9 — No consistent card/section visual language **[Medium]**

Some sections use `<Card>` (Dashboard KPIs), others use `rounded-lg border p-4` DIVs (Account Summary, Notes), and others use no container at all. A consistent "panel" pattern should be defined.

---

## 7. Maintainability & Readability

### 7.1 — `NewSalePage.tsx` is oversized **[Medium]**

`src/pages/sales/NewSalePage.tsx` is ~350+ lines and handles: cart management, customer search, product search, payment type switching, installment config, schedule preview, and form submission. It should be decomposed further:
- `useNewSaleForm` hook for form logic
- Payment type rendering already split but installment config is still tightly coupled

---

### 7.2 — Computed store methods not memoized **[Medium]**

`filteredProducts()`, `filteredSales()`, `filteredCustomers()` in their respective stores are plain functions that run `Array.filter()` on every call. Called from components, they re-compute on every render. These should either be:
- Replaced with `useMemo` at the component level, or
- Converted to derived selectors using Zustand's selector pattern

---

### 7.3 — Two different `chrono_today()` implementations in Rust **[Low]**

`penalty.rs` has its own `chrono_today()` helper. `dashboard.rs` reimplements UTC date logic inline. These should be moved to `src-tauri/src/utils/date.rs` as a shared utility.

---

### 7.4 — `accounts.rs` and `sales.rs` SQL concatenation pattern not shared **[Low]**

Both `get_accounts` and `get_sales` use an identical pattern of building `conditions: Vec<String>` + `params: Vec<Box<dyn ToSql>>` + `format!` where clause. This is ~20 lines repeated in 4+ command files. A `QueryBuilder` helper struct could reduce this boilerplate.

---

### 7.5 — Hooks inconsistently return data vs write to store **[Medium]**

Some hooks return data directly (`useDashboard().fetchDashboard()` returns `DashboardData`), others write to a Zustand store and components read from the store (`useProducts` → `productStore`). This dual pattern makes it harder to reason about data flow:

- `useAccounts` → writes to `accountStore`, components read from `accountStore`
- `useDashboard` → returns data directly, component holds `useState`
- `useReports` → returns data directly

Standardize: hooks that power full pages should write to stores; hooks for one-off fetches can return data directly.

---

### 7.6 — ESLint `react-hooks/exhaustive-deps` suppression **[Low]**

Multiple components suppress the exhaustive-deps rule:

```tsx
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

This hides potential stale closure bugs. The underlying dependencies should be stabilized with `useCallback`/`useRef` instead.

---

*End of audit report. See `docs/12-implementation-plan.md` for the phased remediation plan.*
