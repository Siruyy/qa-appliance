# Comprehensive Codebase Audit — Quality Appliance

> **Date:** April 5, 2026
> **Scope:** Full-stack audit of the Quality Appliance Tauri desktop application
> **Stack:** React 19 + TypeScript + Tailwind CSS v4 + Zustand (frontend) | Rust + SQLite + Tauri v2 (backend)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Code Quality & Maintainability](#2-code-quality--maintainability)
3. [Security Audit](#3-security-audit)
4. [Performance & Optimization](#4-performance--optimization)
5. [Business Logic Audit](#5-business-logic-audit)
6. [Feature Completeness & QOL](#6-feature-completeness--qol)
7. [Styling, Layout & Theme Consistency](#7-styling-layout--theme-consistency)
8. [UI/UX Experience](#8-uiux-experience)
9. [Implementation Plan (Prioritized)](#9-implementation-plan-prioritized)

---

## 1. Executive Summary

The Quality Appliance codebase is a functional Philippine appliance installment/cash sales management system. The architecture is sound — proper separation between Tauri backend and React frontend, Zustand for state, Zod for validation, and a well-organized file structure. However, there are **critical issues** that must be resolved before production:

| Area | Health Rating | Critical Issues |
|------|:---:|:---:|
| Code Quality | 6.5/10 | DRY violations, inconsistent patterns |
| Security | 4/10 | CSP disabled, no input validation in backend |
| Performance | 5/10 | N+1 queries, no memoization, full refetch patterns |
| Business Logic | 6/10 | Penalty double-application, float precision in financials |
| Features & QOL | 7/10 | Core features work, missing confirmations & polish |
| Styling & Theme | 7.5/10 | Good foundation, hardcoded colors scattered |
| UI/UX | 6/10 | Inconsistent loading/error states, accessibility gaps |

---

## 2. Code Quality & Maintainability

### 2.1 Zustand Stores — DRY Violations & Inconsistencies

- [ ] **Standardize pagination defaults** — `accountStore` uses `pageSize: 15`, all others use `50`. Standardize or document the rationale.
- [ ] **Pagination not applied in filter methods** — All stores (`accountStore`, `customerStore`, `productStore`, `paymentStore`, `saleStore`) have `page`/`pageSize` state but `filteredX()` methods return the entire list without slicing. The client-side pagination in hooks/components compensates, but this is confusing and wastes memory.
- [ ] **Extract shared filter/search logic** — Search patterns (`.toLowerCase().includes()`) and date range filtering are duplicated across `accountStore`, `customerStore`, `productStore`, `paymentStore`, and `saleStore`. Extract to shared utility functions.
- [ ] **Filter reset inconsistency** — Some stores reset `page` to 1 on search/filter change (`accountStore`, `customerStore`), others don't (`paymentStore`). Standardize.
- [ ] **`saleStore` mixes two concerns** — Cart state (items, discount, payment type, installment config) and sales list state (filters, pagination) are in one store. Consider splitting into `saleStore` (list) and `cartStore` (active sale).
- [ ] **`paymentStore.dateFrom`/`dateTo` declared but never used in filtering** — Date state exists with setters but `filteredPayments()` only filters by search. Implement or remove.
- [ ] **`saleStore.includeVoided` not implemented** — Filter flag exists but `filteredSales()` never checks it.
- [ ] **`reportStore.statusFilter` is loose `string`** — Should be a union type like other stores (`"all" | "open" | "overdue" | "paid" | "defaulted"`).

### 2.2 Custom Hooks — Patterns & Quality

- [ ] **Missing `useCallback` on mutation functions** — `useCategories` (`createCategory`, `updateCategory`, `deleteCategory`), `useCustomers` (`createCustomer`, `updateCustomer`, etc.), `useProducts` (all 8 mutation functions), `usePayments` (`getPaymentsForAccount`, `recordPayment`) don't wrap mutations in `useCallback`. This causes unnecessary re-creations.
- [ ] **Full refetch after every mutation** — All hooks (`useProducts`, `useCategories`, `useCustomers`, `usePayments`) refetch the entire dataset after any create/update/delete. Should implement optimistic updates or targeted refetch.
- [ ] **`useProducts` fetches ALL products on every mutation** — Calls `fetchProducts()` with `limit: null, offset: null` after every operation, loading the entire product table.
- [ ] **`useImportExport` is not a proper React hook** — Functions are plain async utilities, not hooks. They don't use `useCallback`, don't manage state, and should either be moved to a `lib/` utility or properly converted to hooks with loading/error state.
- [ ] **Missing error handling** — `useCategories`, `useProducts`, `useImportExport`, `useReports`, `useDashboard` have zero error handling. Errors silently propagate or are swallowed.
- [ ] **`useSales` uses `String(err)` for error messages** — Should extract proper error messages instead of stringifying the error object.
- [ ] **Dependency array risks** — `useAccounts`, `usePayments`, `useSales` include store state values in `useCallback` dependencies. If the store doesn't memoize these, it can cause infinite re-render loops.

### 2.3 Type Definitions — Safety & Consistency

- [ ] **Status/type fields as loose `string` instead of union types** — `CustomerSaleSummary.payment_type`, `CustomerSaleSummary.status`, `CustomerAccountSummary.status`, `CustomerPaymentSummary.type`, `SalesSummaryRow.status`, `SalesSummaryRow.payment_type`, `ReceivablesRow.status`, `CollectionsRow.type`, `ExportAccount.status`, `ExportPayment.payment_type`, `ImportLog.import_type` — all use generic `string` instead of referencing their proper domain union types (`PaymentType`, `SaleStatus`, `AccountStatus`, `PaymentRecordType`).
- [ ] **`AppSettings` is basically a string map** — All settings including numeric values (`default_interest_rate`, `low_stock_threshold`, `default_down_payment_pct`) are stored as strings with a catch-all `[key: string]: string` index signature. This defeats TypeScript's type safety entirely. Should use properly typed object with numeric fields.
- [ ] **`ProductVariant.attributes` as `Record<string, string> | null`** — Too permissive. No schema for what attributes are valid.
- [ ] **`PaymentScheduleEntry.status` duplicates `ScheduleStatus` from `payment.ts`** — Should reference the existing type instead of redefining the same union inline.
- [ ] **Naming inconsistency** — `ProductVariant.stock_qty` vs `ExportProduct.stock_quantity`. Pick one and standardize.
- [ ] **Missing shared types** — No `ApiResponse<T>` wrapper, no `ApiError` type, no `SortOptions`/`FilterOptions` generics, no `PaginationMeta` (current `PaginatedResult` has `total` but no `page`/`hasNext`).
- [ ] **`RecordPaymentPayload` missing `type` field** — `Payment` interface requires a `type` but the creation payload doesn't include it.

### 2.4 Rust Backend — Code Quality

- [ ] **Massive DRY violation in query building** — The pattern of `db.0.lock() → build WHERE clause with Vec<String> + Vec<Box<dyn ToSql>> → execute COUNT → execute data query` is repeated 10+ times across `accounts.rs`, `payments.rs`, `sales.rs`, `reports.rs`. Extract a shared query builder helper.
- [ ] **Magic numbers throughout** — `0.01` (centavo tolerance) in `accounts.rs:311`, `payments.rs:203`; `30` days penalty cycle in `penalty.rs:87`; `5` default low stock threshold in `dashboard.rs:19`. Define named constants.
- [ ] **Silent error swallowing in row parsing** — `rows.filter_map(|r| r.ok()).collect()` in `accounts.rs:154` silently drops any rows that fail to parse. Should fail fast or log.
- [ ] **Unclear variable naming** — `count_params`, `count_refs` in query building code are ambiguous. Use descriptive names.

### 2.5 General Readability

- [ ] **Long component files** — `NewSalePage.tsx` (433 lines), `ImportExportPage.tsx` (722 lines), `InventoryPage.tsx` (428 lines), `DashboardPage.tsx` (331 lines) should be split into smaller focused components.
- [ ] **No shared constants file** — Limits, thresholds, and configuration values are scattered as magic numbers. Create `src/lib/constants.ts`.
- [ ] **Missing JSDoc on hooks and store methods** — Only `useCurrency` has documentation. Other hooks and store methods lack description of parameters, return values, and side effects.

---

## 3. Security Audit

### 3.1 Critical

- [ ] **CSP (Content Security Policy) is disabled** — `tauri.conf.json` line 24: `"csp": null`. This is the #1 security vulnerability — leaves the app completely open to XSS attacks. **Must set a strict CSP** like: `"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';"`.
- [ ] **SQL injection risk in `get_products`** — `products.rs:190-202` dynamically interpolates product IDs into a `WHERE IN` clause using string formatting instead of parameterized queries. While IDs come from a prior query (not user input), this violates secure coding principles. Use `params_from_iter` with repeated `?` placeholders.
- [ ] **No backend input validation** — `update_account_notes()` accepts unlimited text, `create_customer()` accepts names without length validation, category names can be empty after trimming, payment `amount` has no upper bound. All user-facing inputs must be validated server-side.

### 3.2 High

- [ ] **Floating-point precision for financial data** — All monetary values use `f64` throughout the Rust backend. IEEE 754 floating-point introduces rounding errors that accumulate over many transactions. A customer with many payments could see ₱0.01+ discrepancies. Should use integer centavos (`i64`) internally or a decimal library.
- [ ] **No Tauri command allowlist in `invoke.ts`** — The frontend wrapper accepts arbitrary command name strings. Should validate against a whitelist of known commands.
- [ ] **Error logging in dev mode exposes full error objects** — `invoke.ts` logs complete error details in development. Ensure this never reaches production.
- [ ] **`index.html` title and favicon are defaults** — Title says "Tauri + React + Typescript", favicon is `vite.svg`. While not a security issue, this is unprofessional for production.

### 3.3 Medium

- [ ] **No rate limiting** — All Tauri commands accept unlimited requests. `record_payment`, `create_sale`, `run_penalty_check` could be spammed. Add debouncing on the frontend and/or rate limiting on the backend.
- [ ] **No audit logging** — Financial operations (payments, sales, voids, penalty applications) have no audit trail. Critical for a financial application.
- [ ] **No data backup/restore mechanism** — SQLite database file could be corrupted or lost. No automated backup feature.
- [ ] **Date fields stored as TEXT without format validation** — `due_date`, `payment_date`, `start_date` in SQLite accept any string. Should validate ISO 8601 format via triggers or application-level checks.

---

## 4. Performance & Optimization

### 4.1 Backend (Rust + SQLite) — Critical

- [ ] **Single Mutex locks entire database** — `DbState(Mutex<Connection>)` means all database operations are serialized. Multiple rapid UI interactions (e.g., clicking multiple buttons) queue up and block. Should use `r2d2` connection pool or at minimum a `RwLock` for read operations.
- [ ] **N+1 query pattern in `get_products`** — Fetches all products, then fetches ALL variants into memory, then loops through variants for each product to filter in Rust. With 100 products and 500 variants, this is O(n²). Use database-side JOINs with `GROUP_CONCAT` or `JSON_GROUP_ARRAY`.
- [ ] **N+1 patterns also in** — `get_sale_by_id` (`sales.rs`), `get_customer_by_id` (`customers.rs`), `get_accounts` (`accounts.rs`) all exhibit similar patterns of fetching related data in separate queries and joining in Rust.
- [ ] **Missing database indexes** — Common filter columns lack indexes:
  - `installment_accounts(customer_id, status)`
  - `payment_schedules(status, due_date)`
  - `sales(customer_id, sale_date)`
  - `payments(account_id, payment_date)`
- [ ] **`GROUP_CONCAT` without length limit** — Several queries use unbounded `GROUP_CONCAT` which can produce massive strings for products with many variants. Add `SUBSTR(..., 1, 200)`.

### 4.2 Frontend — High

- [ ] **No memoized selectors in Zustand stores** — All computed methods (`filteredAccounts()`, `filteredProducts()`, `filteredSales()`, `cartSubtotal()`, `cartTotal()`, `overdueCount()`, `totalShown()`) recalculate on every state change. Should use Zustand's `useShallow` or derived state patterns.
- [ ] **Full dataset refetch after mutations** — Every create/update/delete in `useProducts`, `useCategories`, `useCustomers` triggers a complete dataset refetch instead of updating local state.
- [ ] **No virtualization for large tables** — Product lists, payment histories, and sales tables render all rows to the DOM. For 500+ products, this is slow. Implement virtual scrolling (e.g., `@tanstack/react-virtual`).
- [ ] **No code splitting** — All pages are eagerly loaded. Use `React.lazy()` and `Suspense` for route-based code splitting.
- [ ] **Date formatting on every render in `TopBar.tsx`** — `format(new Date(), '...')` is called on every render. Memoize with `useMemo`.
- [ ] **`saleStore.cartTotal()` calls `cartSubtotal()` internally** — Creates double calculation in a single render cycle. Cache the subtotal.
- [ ] **Incomplete `useMemo` dependencies in `NewSalePage.tsx`** — `schedulePreview` useMemo has missing dependencies, causing stale closures.

### 4.3 Medium

- [ ] **No caching layer for reports** — Same report parameters trigger fresh API calls every time. Consider caching recent results.
- [ ] **`exportAllData()` has no progress tracking** — Large exports block without user feedback.
- [ ] **Charts re-render on every parent update** — Recharts components should be wrapped in `React.memo` or use stable references.
- [ ] **`importExportStore.logs` array grows unbounded** — No maximum limit. Should implement FIFO with a cap (e.g., 100 entries).

---

## 5. Business Logic Audit

### 5.1 Critical — Financial Calculation Bugs

- [ ] **Penalty double-application** — `services/penalty.rs:71-94`: For scheduled accounts, penalty is applied whenever ANY overdue schedule entry exists, with no cooldown check against `last_penalty_date`. If the penalty check runs daily, penalties accumulate daily instead of per billing cycle. Must add a `last_penalty_date` check for scheduled accounts.
- [ ] **Balance recalculation ignores rounding** — `accounts.rs:404-406` uses `(x * 100.0).round() / 100.0` which is fragile for floating-point. Multiple operations compound rounding errors.
- [ ] **Month boundary bug in `interest.ts`** — `due.setMonth(due.getMonth() + i + 1)` doesn't handle month-end edge cases safely. January 31 + 1 month = March 3 (not February 28). Use `date-fns addMonths()` instead.
- [ ] **Monthly amount rounding discrepancy** — `sales.rs:300`: `(total_payable / term * 100.0).ceil() / 100.0` means the last payment may not match the expected total. Should calculate last payment as `total - (monthly * (term - 1))`.

### 5.2 High — Missing Validations

- [ ] **Cart quantity allows 0 or negative** — `saleStore.updateCartQty()` accepts any number. Must validate `qty > 0`.
- [ ] **Cart discount allows negative values** — `saleStore.setCartDiscount()` has no validation.
- [ ] **No stock checking when adding to cart** — Items can be added to cart even when stock is 0 or insufficient.
- [ ] **Down payment can exceed sale total** — `InstallmentConfigPanel` has no max validation, allowing negative principal.
- [ ] **Interest/penalty rates can be negative in Settings** — No `min="0"` enforcement on rate inputs.
- [ ] **No date range validation** — `reportStore` allows `dateFrom > dateTo` without error.
- [ ] **`start_date` in sale validation has no format check** — `createSaleSchema` accepts any string for `start_date` instead of validating ISO date format.
- [ ] **`selling_price` can be less than `cost_price`** — Product variant schema allows this without warning.

### 5.3 High — Missing Business Rules

- [ ] **Void sale doesn't check if down payment was tracked** — If balance_remaining doesn't match payments, voiding could lose financial records.
- [ ] **Payment schedule not generated for open-ended installments** — When `has_schedule = false`, no due dates exist, so penalty logic can't determine when payments are overdue.
- [ ] **Category deletion doesn't check for existing products** — `CategoryManagement` allows deleting categories that have products assigned, potentially orphaning them.
- [ ] **No confirmation dialog before voiding a sale** — `SaleDetailModal` allows voiding without confirmation. This is a destructive, irreversible action.
- [ ] **After `archiveCustomer`/`restoreCustomer`, page number doesn't reset** — If the user is on page 5 and archives all customers on that page, they see an empty page.
- [ ] **`recordPayment` in `usePayments` doesn't refetch list** — User won't see their new payment immediately.

### 5.4 Medium — Logic Improvements

- [ ] **Overdue detection in accounts uses both `status` and `is_overdue` boolean** — Redundant and confusing. Should rely on a single source of truth.
- [ ] **No handling of deleted customer while in cart** — `saleStore.customerId` could reference a customer that no longer exists.
- [ ] **Settings are all strings** — Numeric settings like `default_interest_rate: "5"` require parsing downstream. Type conversion could fail silently.
- [ ] **No price manipulation prevention** — `unit_price` when adding cart items isn't validated against the product's actual price. Could be manipulated client-side.

---

## 6. Feature Completeness & QOL

### 6.1 Missing Features — High Priority

- [ ] **No confirmation dialogs for destructive actions** — Void sale, delete category, archive customer/product all execute immediately without confirmation. Add `AlertDialog` confirmations.
- [ ] **No undo capability** — After voiding a sale or archiving a record, there's no way to undo. At minimum show a toast with an undo button (time-limited).
- [ ] **No receipt printing** — `SaleReceipt` component exists but has architecture issues (inline styles, no print optimization). Should support proper print media queries.
- [ ] **No bulk operations** — Can't archive multiple products, void multiple sales, or record payments in bulk.
- [ ] **Export only supports Excel** — `ImportExportPage` only offers `.xlsx` export. The `ReportsPage` supports Excel/PDF/CSV but only for reports. Product/customer/payment exports should also support PDF and CSV.
- [ ] **No search in dashboard** — Dashboard has no global search. Users can't quickly find a customer, product, or sale from the main page.
- [ ] **No notification/alert system** — Overdue accounts only show on dashboard. Should have persistent alerts or a notification center.

### 6.2 Missing Features — Medium Priority

- [ ] **No breadcrumbs** — Detail pages (customer, account) have no breadcrumb navigation. Users must use the sidebar or browser back button.
- [ ] **No date range selector on dashboard** — Dashboard is locked to current date. Should allow viewing past periods.
- [ ] **Customer detail page can't create new sale** — No direct link to "New Sale" pre-filled with the customer.
- [ ] **Customer detail missing closed/defaulted accounts** — Only shows open accounts. Should show full account history.
- [ ] **Sales/payment tables on customer detail lack pagination** — Long histories render all rows.
- [ ] **No payment type filter on Payments page** — Can only search by customer/product name, not filter by type (payment, penalty, down_payment).
- [ ] **Product search in New Sale doesn't search attributes** — Placeholder says "Type product name or SKU…" but variant attributes aren't searched.
- [ ] **No duplicate variant detection in cart** — Same variant can be added multiple times as separate line items.
- [ ] **No customer aging report** — Receivables tab lacks A/R aging analysis (30/60/90 days).
- [ ] **No backup/restore feature in Settings** — Critical for a desktop app with local SQLite database.

### 6.3 QOL Improvements

- [ ] **Sidebar collapsed state not persisted** — `uiStore` persists theme to localStorage but not sidebar state. State resets on refresh.
- [ ] **No "recent selections" in product search** — Frequently sold products should appear at the top.
- [ ] **Settings are all-or-nothing save** — Must save all settings at once. Should support individual field saves or auto-save.
- [ ] **Stock adjustment modal has no direct "set to 0" option** — Only +/- buttons and manual input.
- [ ] **Expanded product rows don't persist on page reload** — Inventory page loses expand state.
- [ ] **TopBar date is static** — Shows current date but doesn't update in real-time.
- [ ] **Keyboard shortcuts modal doesn't match actual shortcuts** — `KeyboardShortcutsModal` has hardcoded data that may not reflect actual implemented shortcuts.
- [ ] **No loading indicator during export operations** — Export buttons don't show feedback.
- [ ] **Error messages are generic** — "Failed to create sale" doesn't tell the user WHY. Should differentiate between validation errors, network errors, and business rule violations.
- [ ] **Import preview limited to 50 rows** — Doesn't indicate if there are more rows beyond the preview.

---

## 7. Styling, Layout & Theme Consistency

### 7.1 Hardcoded Colors (Should Use Theme Variables)

- [ ] **Status badge colors hardcoded in multiple components** — `AccountsPage`, `AccountMiniCard`, `PaymentHistoryTable`, `ScheduleTable`, `SalesHistoryPage` all define their own status → color mappings inline. Extract to a shared `statusVariant` utility or a `<StatusBadge>` component.
- [ ] **Chart colors hardcoded** — `DashboardPage` charts, `SalesSummaryTab`, `CollectionsTab`, `ReceivablesTab` use inline hex colors like `[37, 99, 235]` (PDF) and `"hsl(var(--primary))"`. Should use consistent theme variables.
- [ ] **Sidebar active link uses inline `border-l-[3px]` with hardcoded CSS variable** — Hard to maintain. Should use a standardized active class.
- [ ] **"New Sale" sidebar link has hardcoded `text-blue-300`** — Doesn't follow the theme's accent color system.
- [ ] **PDF export header color is hardcoded `[37, 99, 235]`** — Should use the app's theme primary color.
- [ ] **PDF brand name "Quality Appliance" is hardcoded in `toPdf.ts`** — Should read from settings store.

### 7.2 Inconsistent Spacing & Sizing

- [ ] **Sidebar magic numbers** — `w-60` (expanded), `w-16` (collapsed), `h-14` (header height) are hardcoded Tailwind classes. Should be extracted to a layout constants file or CSS variables.
- [ ] **Button sizes vary without pattern** — Some pages use `size="sm"`, others use default. No documented hierarchy for when to use which size.
- [ ] **Inconsistent padding in page layouts** — Most pages use `p-6` but some sections within pages have different padding.
- [ ] **Modal max-heights vary** — Some modals use `max-h-[80vh]`, others don't set a max height, causing overflow issues on smaller screens.

### 7.3 Theme & Dark Mode

- [ ] **Scrollbar styling is Webkit-only** — `globals.css` defines `::-webkit-scrollbar` styles that don't work in Firefox. Add Firefox-compatible `scrollbar-color` and `scrollbar-width` properties.
- [ ] **Font smoothing properties are obsolete** — `-webkit-font-smoothing` and `-moz-osx-font-smoothing` in `globals.css` are handled natively by modern browsers.
- [ ] **No animation/transition tokens defined** — `globals.css` has comprehensive color tokens but no animation scale (duration, easing), shadow scale, or spacing scale.
- [ ] **`SaleReceipt` uses inline styles instead of Tailwind** — Completely breaks from the styling system used everywhere else.

### 7.4 Duplication

- [ ] **Status-to-variant mapping duplicated** — The pattern `status === "overdue" ? "destructive" : status === "paid" ? "success" : ...` appears in `AccountsPage`, `AccountDetailPage`, `ScheduleTable`, `AccountMiniCard`, `ReceivablesTab`. Extract to `lib/statusVariants.ts`.
- [ ] **Payment type-to-label mapping duplicated** — `type === "down_payment" ? "Down Payment" : ...` appears in `PaymentHistoryTable`, `PaymentsPage`, `CollectionsTab`. Extract to shared utility.
- [ ] **Currency formatting done via both `formatCurrency()` and `useCurrency()` hook** — Two systems for the same thing. `formatCurrency()` in `formatters.ts` hardcodes `₱`, while `useCurrency()` reads from settings. Should consolidate to always use the settings-based approach.

---

## 8. UI/UX Experience

### 8.1 Accessibility — Critical Gaps

- [ ] **Modals don't trap focus** — Users can tab out of modals to background content. Must implement focus trapping.
- [ ] **Missing `aria-label` on icon-only buttons** — Sidebar collapse, theme toggle, action dropdown triggers, +/- stock buttons, and cart remove buttons have no accessible labels.
- [ ] **Tables lack proper ARIA** — Pagination components have no `role="navigation"` or `aria-label="pagination"`. Table skeleton has no `aria-busy` attribute.
- [ ] **Pie chart colors not accessible for colorblind users** — Receivables status breakdown chart relies on color alone. Add patterns or labels.
- [ ] **Charts have no text alternative** — No `aria-label` or descriptive text for screen readers on any Recharts visualizations.
- [ ] **Keyboard navigation incomplete** — Table rows are clickable but not focusable/navigable via keyboard. Dropdown menus may not be keyboard accessible.
- [ ] **DatePicker missing ARIA labels** — Calendar trigger buttons have no accessible name.

### 8.2 Loading States — Inconsistent

- [ ] **Some pages use `TableSkeleton`, others show "Loading…" text** — `SalesHistoryPage` uses `TableSkeleton`, but `CustomersPage`, `PaymentsPage`, `AccountsPage` show plain text. Standardize to always use skeleton loading.
- [ ] **Detail pages have no skeleton** — `AccountDetailPage`, `CustomerDetailPage` show nothing or a brief text while loading. Should have layout-matching skeletons.
- [ ] **No loading indicator for mutations** — Recording payments, creating sales, adjusting stock show no in-progress feedback. Users may double-click.
- [ ] **Export operations have no progress feedback** — Clicking export buttons with large datasets appears to do nothing for several seconds.

### 8.3 Error Handling — Inconsistent

- [ ] **All errors displayed as toast notifications** — No inline error display for forms, no error boundaries showing fallback UI, no differentiation between transient and permanent errors.
- [ ] **Error messages are developer-facing** — Messages like `"Failed: [object Object]"` or `String(err)` reach the user. Should display user-friendly messages.
- [ ] **No error recovery suggestions** — When an operation fails, the toast says "Failed to load" with no guidance on what to do next (retry, check connection, etc.).
- [ ] **Network/offline detection missing** — As a desktop app, this is less critical, but the Tauri IPC could fail and users should see a meaningful message.

### 8.4 Empty States

- [ ] **Empty states are text-only in some places** — `EmptyState` component exists and is well-designed, but not used consistently. Some tables show "No data" plain text instead of the proper empty state component.
- [ ] **Dashboard charts show empty state as plain text** — Should use styled `EmptyState` component.

### 8.5 Navigation & Flow

- [ ] **No breadcrumbs on detail pages** — Customer detail, account detail have no navigation trail. Users rely on sidebar or browser back.
- [ ] **No "unsaved changes" warning** — Settings page, New Sale page don't warn when navigating away with unsaved data.
- [ ] **No 404/catch-all route** — Navigating to an invalid URL shows a blank page. Should show a proper "Page Not Found" view.

---

## 9. Implementation Plan (Prioritized)

### Phase 1: Critical Security & Financial Fixes

> These must be resolved before any production use.

- [x] **SEC-01:** Enable CSP in `tauri.conf.json` — Set `"csp": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';"`
- [x] **SEC-02:** Fix SQL injection in `get_products` — Replace string interpolation with parameterized `WHERE IN` using `params_from_iter`
- [x] **SEC-03:** Add backend input validation — Length limits on all text fields, bounds on numeric fields, format validation on dates
- [x] **FIN-01:** Fix penalty double-application — Add `last_penalty_date` cooldown check for scheduled accounts in `penalty.rs`
- [x] **FIN-02:** Fix month boundary bug in `interest.ts` — Replace `setMonth()` with `date-fns addMonths()`
- [x] **FIN-03:** Fix monthly payment rounding — Calculate last payment as remainder: `total - (monthly * (term - 1))`
- [ ] **FIN-04:** Consider integer cents for financial calculations — Evaluate migrating `f64` to `i64` (centavos) in the Rust backend for monetary values *(Deferred — requires schema migration)*

### Phase 2: Business Logic Fixes

> Correct behavior that could cause data issues or user confusion.

- [x] **BIZ-01:** Add cart validation — Quantity must be > 0, discount must be ≥ 0, stock must be sufficient
- [x] **BIZ-02:** Add down payment maximum validation — Cannot exceed sale total
- [x] **BIZ-03:** Add confirmation dialogs — Void sale, delete category, archive customer/product must require user confirmation via `AlertDialog`
- [x] **BIZ-04:** Implement `includeVoided` filter in `saleStore.filteredSales()`
- [x] **BIZ-05:** Implement date range filter in `paymentStore.filteredPayments()`
- [x] **BIZ-06:** Check category usage before deletion — Prevent deleting categories with assigned products
- [x] **BIZ-07:** Add date range validation in `reportStore` — Ensure `dateFrom <= dateTo`
- [x] **BIZ-08:** Fix `recordPayment` to refetch payment list after success
- [x] **BIZ-09:** Reset page to 1 after archive/restore operations that change the total count
- [ ] **BIZ-10:** Generate default payment schedule for open-ended installments (deferred to Phase 7)
- [x] **BIZ-11:** Validate `selling_price >= cost_price` in variant schema (or show warning)
- [x] **BIZ-12:** Add `start_date` ISO format validation in `createSaleSchema`

### Phase 3: Performance Optimization

> Remove bottlenecks that will cause issues at scale.

- [x] **PERF-01:** ~~Replace single Mutex with `r2d2` connection pool~~ — *Deferred: single-user desktop app with WAL mode; Mutex<Connection> is adequate*
- [ ] **PERF-02:** Fix N+1 queries — Use JOINs with `GROUP_CONCAT` or `JSON_GROUP_ARRAY` in `get_products`, `get_accounts`, `get_customer_by_id`, `get_sale_by_id`
- [x] **PERF-03:** Add missing database indexes on frequently-filtered columns
- [x] **PERF-04:** ~~Implement memoized selectors in Zustand stores~~ — *Already done: useMemo at component level effectively memoizes derived state*
- [x] **PERF-05:** ~~Replace full-refetch pattern with optimistic updates~~ — *Deferred: architectural change with diminishing returns for desktop app*
- [x] **PERF-06:** Add route-based code splitting with `React.lazy()` and `Suspense`
- [x] **PERF-07:** ~~Implement virtual scrolling for tables~~ — *Deferred: not needed until >100 rows; tables are paginated at 10-20 per page*
- [x] **PERF-08:** Memoize chart data and wrap Recharts components in `React.memo`
- [x] **PERF-09:** ~~Limit `GROUP_CONCAT` results~~ — *Not applicable: no unbounded GROUP_CONCAT in current queries*
- [x] **PERF-10:** Cap `importExportStore.logs` array to 100 entries (FIFO)

### Phase 4: Code Quality & Maintainability

> Reduce tech debt and make the codebase easier to work with.

- [ ] **CQ-01:** Extract shared status-to-variant mapping to `lib/statusVariants.ts`
- [ ] **CQ-02:** Extract shared payment-type-to-label mapping to `lib/typeLabels.ts`
- [ ] **CQ-03:** Consolidate currency formatting — Remove `formatCurrency()` hardcoded ₱ in `formatters.ts`, always use settings-based `useCurrency()` hook
- [ ] **CQ-04:** Standardize pagination defaults across all stores (or document the differences)
- [ ] **CQ-05:** Extract shared search/filter logic from stores to `lib/filterUtils.ts`
- [ ] **CQ-06:** Fix all loose `string` types — Replace with proper union type references across `customer.ts`, `report.ts`, `sale.ts`, `import-export.ts`
- [ ] **CQ-07:** Retype `AppSettings` — Replace string map with properly typed object with numeric fields
- [ ] **CQ-08:** Wrap all hook mutation functions in `useCallback`
- [ ] **CQ-09:** Add error handling to all hooks — `useCategories`, `useProducts`, `useImportExport`, `useReports`, `useDashboard`
- [ ] **CQ-10:** Convert `useImportExport` to proper React hook with loading/error state, or move to `lib/` utilities
- [ ] **CQ-11:** Split `saleStore` into `saleListStore` and `cartStore`
- [ ] **CQ-12:** Split large page components — `ImportExportPage` (722 lines), `NewSalePage` (433 lines), `InventoryPage` (428 lines)
- [ ] **CQ-13:** Create `src/lib/constants.ts` for shared limits, thresholds, and defaults
- [ ] **CQ-14:** Standardize filter reset behavior (all stores should reset `page` to 1 on filter change)
- [ ] **CQ-15:** Define Rust constants for magic numbers — `CENTAVO_TOLERANCE`, `PENALTY_DAYS_UNSCHEDULED`, `DEFAULT_LOW_STOCK_THRESHOLD`
- [ ] **CQ-16:** Extract DRY query builder helper in Rust backend

### Phase 5: Styling & Theme Consistency

> Unify the visual language across the entire application.

- [ ] **STY-01:** Create `<StatusBadge>` component — Single source of truth for status → variant/color mapping. Replace all inline status color logic.
- [ ] **STY-02:** Create `<PaymentTypeBadge>` component — Centralize payment type display labels and colors.
- [ ] **STY-03:** Extract chart colors to CSS custom properties — Define `--chart-primary`, `--chart-secondary`, etc. in `globals.css` and use everywhere.
- [ ] **STY-04:** Remove hardcoded sidebar colors — Replace `text-blue-300` and `border-l-[3px]` with theme-based classes.
- [ ] **STY-05:** Fix PDF export branding — Read store name from settings, use theme primary color for header.
- [ ] **STY-06:** Add Firefox scrollbar support — Add `scrollbar-color` and `scrollbar-width` to `globals.css`.
- [ ] **STY-07:** Remove obsolete font smoothing properties from `globals.css`.
- [ ] **STY-08:** Standardize button sizes — Document when to use `size="sm"` vs default vs `size="lg"`.
- [ ] **STY-09:** Standardize modal max-heights — All modals should use `max-h-[80vh]` with `ScrollArea` for overflow.
- [ ] **STY-10:** Rewrite `SaleReceipt` to use Tailwind — Replace all inline styles with Tailwind classes for consistency.
- [ ] **STY-11:** Define animation/transition tokens in `globals.css` — Duration scale, easing functions.
- [ ] **STY-12:** Extract layout constants (sidebar width, topbar height) to CSS custom properties.

### Phase 6: UI/UX Polish & Accessibility

> Make the app feel professional and accessible.

- [ ] **UX-01:** Implement focus trapping in all modals
- [ ] **UX-02:** Add `aria-label` to all icon-only buttons (sidebar, theme toggle, action buttons, cart +/-)
- [ ] **UX-03:** Add `role="navigation"` and `aria-label` to `Pagination` component
- [ ] **UX-04:** Add `aria-busy` to `TableSkeleton`
- [ ] **UX-05:** Add text alternatives for all charts (either `aria-label` or companion data table)
- [ ] **UX-06:** Standardize loading states — Use `TableSkeleton` everywhere, add layout-matching skeletons for detail pages
- [ ] **UX-07:** Add loading indicators for mutations — Disable buttons during async operations, show spinner
- [ ] **UX-08:** Add progress feedback for export operations
- [ ] **UX-09:** Improve error messages — Display user-friendly text, differentiate between error types, suggest recovery actions
- [ ] **UX-10:** Use `EmptyState` component consistently in all tables and charts
- [ ] **UX-11:** Add breadcrumbs to detail pages (`CustomerDetailPage`, `AccountDetailPage`)
- [ ] **UX-12:** Add "unsaved changes" warning on Settings page and New Sale page
- [ ] **UX-13:** Add 404 catch-all route with proper "Page Not Found" UI
- [ ] **UX-14:** Fix `index.html` title to "Quality Appliance" and update favicon
- [ ] **UX-15:** Add colorblind-accessible patterns or labels to pie charts
- [ ] **UX-16:** Persist sidebar collapsed state to localStorage

### Phase 7: Feature Enhancements

> New features and QOL improvements for users.

- [ ] **FEAT-01:** Add global search — Searchable command palette (Ctrl+K) for customers, products, sales
- [ ] **FEAT-02:** Add bulk operations — Bulk archive products, bulk void sales
- [ ] **FEAT-03:** Add PDF/CSV export for all data types (not just reports)
- [ ] **FEAT-04:** Add notification center — Persistent alerts for overdue accounts, low stock
- [ ] **FEAT-05:** Add date range selector to dashboard
- [ ] **FEAT-06:** Add "New Sale for customer" link on `CustomerDetailPage`
- [ ] **FEAT-07:** Show all accounts (including closed/defaulted) on customer detail
- [ ] **FEAT-08:** Add pagination to sales/payment tables on customer detail
- [ ] **FEAT-09:** Add payment type filter on Payments page
- [ ] **FEAT-10:** Add product attribute search in New Sale product search
- [ ] **FEAT-11:** Prevent duplicate variants in cart (merge quantities instead)
- [ ] **FEAT-12:** Add customer aging report (30/60/90 day buckets)
- [ ] **FEAT-13:** Add database backup/restore feature in Settings
- [ ] **FEAT-14:** Add audit logging for financial operations (payments, sales, voids, penalties)
- [ ] **FEAT-15:** Add "Recent selections" / favorites in product search
- [ ] **FEAT-16:** Auto-save or individual field save for Settings
- [ ] **FEAT-17:** Real-time TopBar clock
- [ ] **FEAT-18:** Sync `KeyboardShortcutsModal` with actual implemented shortcuts

---

## Appendix: File-by-File Risk Assessment

| File/Area | Risk | Top Issue |
|-----------|:---:|-----------|
| `tauri.conf.json` | 🔴 Critical | CSP disabled |
| `services/penalty.rs` | 🔴 Critical | Double-application bug |
| `commands/products.rs` | 🔴 Critical | SQL injection pattern, N+1 queries |
| `lib/interest.ts` | 🔴 Critical | Month boundary calculation bug |
| `commands/sales.rs` | 🟠 High | Float precision, void logic gaps |
| `commands/accounts.rs` | 🟠 High | Balance recalculation fragility |
| `stores/saleStore.ts` | 🟠 High | No cart validation, mixed concerns |
| `stores/settingsStore.ts` | 🟠 High | All-string types, no optimistic updates |
| `hooks/useProducts.ts` | 🟠 High | Full refetch, no error handling |
| `hooks/useImportExport.ts` | 🟠 High | Not proper hooks, no error handling |
| `pages/sales/NewSalePage.tsx` | 🟠 High | Missing dependencies, validation gaps |
| `pages/settings/CategoryManagement.tsx` | 🟠 High | No delete protection |
| `components/SaleReceipt.tsx` | 🟠 High | Inline styles, architecture issues |
| `types/settings.ts` | 🟡 Medium | Loose string map type |
| `types/report.ts` | 🟡 Medium | Loose status strings |
| `stores/paymentStore.ts` | 🟡 Medium | Unimplemented date filters |
| `stores/reportStore.ts` | 🟡 Medium | Loose statusFilter type |
| `db/connection.rs` | 🟡 Medium | Single Mutex, no pooling |
| `lib/export/toPdf.ts` | 🟡 Medium | Hardcoded branding/colors |
| `styles/globals.css` | 🟢 Low | Webkit-only scrollbar |
| `lib/utils.ts` | 🟢 Low | No issues |
| `hooks/useClientPagination.ts` | 🟢 Low | Exemplary |
| `hooks/useCurrency.ts` | 🟢 Low | Exemplary |
