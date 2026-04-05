# QA-Appliance — Comprehensive Audit Report (v2)

**Date:** 2025  
**Auditor:** GitHub Copilot  
**Scope:** Full codebase — navigation, runtime correctness, type safety, business logic, UX, performance

---

## Executive Summary

The application is architecturally sound with good separation between Rust (IPC commands) and React (UI). All routes are defined and sidebar navigation links are valid. However, **two critical runtime bugs** cause crashes when navigating to specific pages, and **three additional high-severity bugs** cause silent failures in features.

---

## Feature Scoring

| Module / Feature | Score | Status |
|---|---|---|
| Dashboard | 8/10 | ✅ Works — good KPIs, charts |
| Inventory Management | 9/10 | ✅ Complete, pagination works |
| New Sale (Cash) | 8/10 | ✅ Works, cart/discount/notes wired |
| New Sale (Installment) | 8/10 | ✅ Works, preset terms/DP buttons |
| Sales History | 7/10 | ⚠️ Date filter uses wrong field (`created_at` vs `sale_date`) |
| Customer List | 8/10 | ✅ Mostly works, server-side pagination |
| Customer Detail | 9/10 | ✅ Complete, shows accounts/sales/payments |
| Accounts List | 7/10 | ⚠️ Works, but navigating to detail crashes |
| **Account Detail** | **3/10** | 🔴 **CRITICAL — React hooks violation crashes page** |
| Record Payment | 8/10 | ✅ Works — schedule selection, auto-apply |
| Payments List | 8/10 | ✅ Works — server-side paginated |
| Reports — Sales Summary | 8/10 | ✅ Charts + table work |
| Reports — Receivables | 8/10 | ✅ Pie chart + accounts table |
| Reports — Inventory | 8/10 | ✅ Bar chart + items list |
| Reports — Collections | 8/10 | ✅ Area chart + payment history |
| **Reports — Customer History** | **2/10** | 🔴 **CRITICAL — calls non-existent IPC command** |
| Reports — Profit/Loss | 8/10 | ✅ Charts + category breakdown |
| Import / Export | 7/10 | ✅ Works — `formatCurrency` placement messy but functional |
| Settings | 9/10 | ✅ Fully wired, category management works |
| Dark / Light Mode | 9/10 | ✅ System-aware, persisted in store |
| Keyboard Shortcuts | 9/10 | ✅ `?`, `Ctrl+N`, `Ctrl+,` all work |
| Penalty Check (startup) | 5/10 | ⚠️ Type mismatch: expects `number`, gets `Vec` |
| **Demo Seed Data** | **0/10** | 🔴 **Missing — no data to demo with** |

**Overall Score: 6.8/10**

---

## Critical Bugs

### Bug 1 — React Hooks Violation in `AccountDetailPage.tsx`

**File:** `src/pages/accounts/AccountDetailPage.tsx`  
**Severity:** 🔴 CRITICAL — causes navigation error  

`useCurrency()` is called **after** two conditional early returns:

```tsx
if (loading) {
  return <div>Loading...</div>;  // ← early return
}
if (!account) {
  return <div>Account not found</div>;  // ← early return
}
const { format: formatCurrency } = useCurrency();  // ← HOOK AFTER CONDITIONAL RETURN
return (...)
```

React's Rules of Hooks require hooks to be called **in the same order on every render**. When `loading = true` (on first render), the component returns before calling `useCurrency()`. On the next render when `loading = false`, it calls one more hook than before → React throws:  
> **"Rendered fewer hooks than expected. This may be caused by an accidental early return statement."**

**Fix:** Move `useCurrency()` to the top of the component, before all conditional returns.

---

### Bug 2 — Non-existent IPC Command in `CustomerHistoryTab.tsx`

**File:** `src/pages/reports/CustomerHistoryTab.tsx`  
**Severity:** 🔴 CRITICAL — Customer History report tab broken  

Three problems:

```tsx
invoke<{ id: number; first_name: string; last_name: string }[]>("list_customers", {
  searchQuery: null,
  isActive: true,
})
```

1. **Command doesn't exist:** `list_customers` is not registered in `lib.rs`. The correct command is `get_customers`.
2. **Wrong parameter names:** `searchQuery`/`isActive` should be `search`/`include_archived`.
3. **Wrong field names:** `Customer` model has a single `name` field, not `first_name`/`last_name`.

The `catch(() => {})` silently swallows the error, so the customer dropdown stays empty.

**Fix:** Use `get_customers` with correct params, map `c.name` directly.

---

## High Severity Bugs

### Bug 3 — Penalty Check Type Mismatch in `AppShell.tsx`

**File:** `src/app/layout/AppShell.tsx`  
**Severity:** 🟠 HIGH — penalty notifications never show  

```tsx
invoke<number>("run_penalty_check")
  .then((count) => {
    if (count > 0) { // ← count is actually PenaltyApplied[], not number
```

The Rust command returns `Vec<PenaltyApplied>`. An array compared to `0` in JS:
- Empty array `[]` coerces to `0` → `[] > 0` → `false` → toast never shown
- Non-empty array coerces to `NaN` → `NaN > 0` → `false` → toast still never shown

**Fix:** `invoke<PenaltyApplied[]>` and check `.length`.

---

### Bug 4 — Wrong Date Field in `saleStore.ts` Filter

**File:** `src/stores/saleStore.ts`  
**Severity:** 🟠 HIGH — date filters on Sales History produce wrong results  

```ts
if (filters.dateFrom && s.created_at < filters.dateFrom) return false;
if (filters.dateTo && s.created_at > filters.dateTo + "T23:59:59") return false;
```

`created_at` is the record creation timestamp. `sale_date` is the actual transaction date (used by Rust server-side filtering). The date range filters should use `sale_date`.

**Fix:** Change `s.created_at` → `s.sale_date` in both comparisons.

---

## Medium Severity Issues

### Bug 5 — Missing TypeScript Field: `cost_price_snapshot`

**File:** `src/types/sale.ts`  
**Severity:** 🟡 MEDIUM — P&L reports may see `undefined`  

Database V3 migration adds `cost_price_snapshot` to `sale_items`. Rust `SaleItem` model has it. TypeScript `SaleItem` interface is missing it.

**Fix:** Add `cost_price_snapshot?: number;` to the `SaleItem` interface.

---

### Code Quality — `useCurrency` / `formatCurrency` Position

**Files:** `RecordPaymentModal.tsx`, `ReportsPage.tsx`, `ImportExportPage.tsx`  
**Severity:** 🟡 MEDIUM — messy but technically functional  

In these files, `useCurrency()` is called at the bottom of the function body, after callbacks that use `formatCurrency`. JavaScript closure semantics make this work at runtime (callbacks capture variable references, not values), but it's poor practice and violates the convention of declaring hooks at the top.

**Fix:** Move `useCurrency()` calls to the top of each component/function.

---

## Missing Features

### Seed Data for Demo

**Severity:** 🔴 Required for any meaningful demo  

The app has no sample data. A V4 migration should insert:
- 8 categories, ~35 products with ~70 variants
- ~60 customers with Filipino names/phones
- ~400 sales spanning 2 years (cash + installment)
- ~100 installment accounts with payment schedules
- Varied statuses: open, overdue, paid, defaulted
- Realistic payment history

---

## Summary

| Severity | Count | Impact |
|---|---|---|
| 🔴 Critical | 2 | Navigation crashes on Account Detail; Customer History report broken |
| 🟠 High | 2 | Penalty check silent failure; wrong date filters on Sales |
| 🟡 Medium | 2 | Missing TS type field; hook placement |
| 🔵 Missing | 1 | No demo seed data |
