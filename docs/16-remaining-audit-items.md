# Remaining Audit Items — Phase 8+

> **Date:** April 5, 2026
> **Scope:** All remaining items from `docs/15-comprehensive-audit.md` plus utang removal
> **Predecessor:** Phases 1-7 complete (74 items done)

---

## Phase 8: Remove Utang & Simplify Payment Model

> Payment can only be **cash** or **installment**. Remove all "utang" / "open credit" / "open-ended" concepts.
> Installments always have a payment schedule (`has_schedule` is always `1`).

- [ ] **UTG-01:** Remove `AccountType = "installment" | "utang"` from `src/types/account.ts`
- [ ] **UTG-02:** Remove `has_schedule` toggle from `InstallmentConfigPanel.tsx` — always true
- [ ] **UTG-03:** Remove "Utang" filter option from `AccountsPage.tsx` type filter dropdown
- [ ] **UTG-04:** Remove "Utang" label from `AccountsPage.tsx` table, `AccountDetailPage.tsx`, `AccountMiniCard.tsx`
- [ ] **UTG-05:** Remove `"utang"` from `accountStore.ts` type filter logic
- [ ] **UTG-06:** Remove `"utang"` branch from `accounts.rs` backend filter
- [ ] **UTG-07:** Remove "open-ended" fallback text from `ScheduleTable.tsx`
- [ ] **UTG-08:** Clean up `penalty.rs` — remove `has_schedule` branching (always has schedule)
- [ ] **UTG-09:** Clean up `sales.rs` — remove `has_schedule` branching, always generate schedule
- [ ] **UTG-10:** Update `NewSalePage.tsx` button label from "Installment (Utang)" to "Installment"
- [ ] **UTG-11:** Update `.github/copilot-instructions.md` — remove "Installment vs Utang" section
- [ ] **UTG-12:** Update `import_export.rs` — simplify `has_schedule` handling in import/export

---

## Phase 9: Critical Business Logic & Security

- [ ] **BIZ-R01:** Fix `useMemo` stale closure in `NewSalePage.tsx` — `schedulePreview` has missing dependencies
- [ ] **BIZ-R02:** Validate `unit_price` server-side in `sales.rs` — prevent client-side price manipulation
- [ ] **BIZ-R03:** Void sale should verify payment balance integrity before voiding
- [ ] **BIZ-R04:** Add `min="0"` enforcement on interest/penalty rate inputs in Settings
- [ ] **BIZ-R05:** Handle deleted customer in cart — `saleStore.customerId` could reference archived customer
- [ ] **SEC-R01:** Add Tauri command allowlist validation in `invoke.ts`
- [ ] **SEC-R02:** Sanitize error logging — ensure full error objects don't leak in production builds
- [ ] **SEC-R03:** Add SQLite date format validation via application-level checks on date fields

---

## Phase 10: Performance Optimization

- [ ] **PERF-R01:** Fix N+1 queries in `get_products` — use JOINs with `GROUP_CONCAT`/`JSON_GROUP_ARRAY`
- [ ] **PERF-R02:** Fix N+1 patterns in `get_accounts`, `get_customer_by_id`, `get_sale_by_id`
- [ ] **PERF-R03:** Memoize `TopBar.tsx` date formatting with `useMemo`
- [ ] **PERF-R04:** Cache `saleStore.cartSubtotal()` result to avoid double calculation in `cartTotal()`
- [ ] **PERF-R05:** Add report caching layer — same parameters shouldn't re-fetch
- [ ] **PERF-R06:** Add progress tracking to `exportAllData()`

---

## Phase 11: Code Quality & Maintainability

- [ ] **CQ-R01:** Extract DRY query builder helper in Rust — shared WHERE clause + COUNT + data pattern
- [ ] **CQ-R02:** Fix silent error swallowing — `rows.filter_map(|r| r.ok())` should log/fail-fast
- [ ] **CQ-R03:** Improve variable naming — `count_params`/`count_refs` → descriptive names
- [ ] **CQ-R04:** Fix `useSales` — use proper error extraction instead of `String(err)`
- [ ] **CQ-R05:** Extract shared search/filter logic from stores to `lib/filterUtils.ts`
- [ ] **CQ-R06:** Retype `AppSettings` — use properly typed object instead of string map
- [ ] **CQ-R07:** Add `useCallback` to mutation functions in hooks
- [ ] **CQ-R08:** Convert `useImportExport` to proper hook or move to `lib/` utility
- [ ] **CQ-R09:** Split `saleStore` into `saleListStore` and `cartStore`
- [ ] **CQ-R10:** Split large page components — `ImportExportPage` (722 lines), `NewSalePage`, `InventoryPage`
- [ ] **CQ-R11:** Fix `RecordPaymentPayload` missing `type` field
- [ ] **CQ-R12:** Fix `PaymentScheduleEntry.status` — reference `ScheduleStatus` instead of redefining
- [ ] **CQ-R13:** Standardize naming — `stock_qty` vs `stock_quantity`
- [ ] **CQ-R14:** Add shared types — `ApiError`, `SortOptions`/`FilterOptions` generics
- [ ] **CQ-R15:** Add `ProductVariant.attributes` schema validation
- [ ] **CQ-R16:** Store-level pagination — apply slicing in `filteredX()` methods
- [ ] **CQ-R17:** Fix dependency array risks in `useAccounts`, `usePayments`, `useSales`
- [ ] **CQ-R18:** Add JSDoc to hooks and store methods
- [ ] **CQ-R19:** Fix full refetch after mutations — implement targeted refetch or optimistic updates

---

## Phase 12: Styling & Theme

- [ ] **STY-R01:** Fix sidebar active link — replace inline `border-l-[3px]` with standardized active class
- [ ] **STY-R02:** Fix PDF export header color — use theme primary instead of hardcoded `[37, 99, 235]`
- [ ] **STY-R03:** Fix PDF brand name — read "Quality Appliance" from settings store
- [ ] **STY-R04:** Document button size hierarchy — when to use `size="sm"` vs default
- [ ] **STY-R05:** Standardize page padding — consistent `p-6` across all pages
- [ ] **STY-R06:** Consolidate currency formatting — deprecate `formatCurrency()` in favor of `useCurrency()` hook
- [ ] **STY-R07:** Remove obsolete font smoothing properties from `globals.css`

---

## Phase 13: UI/UX Polish

- [ ] **UX-R01:** Standardize loading states — use `TableSkeleton` everywhere instead of "Loading…" text
- [ ] **UX-R02:** Add detail page skeletons — `AccountDetailPage`, `CustomerDetailPage`
- [ ] **UX-R03:** Improve error messages — user-friendly messages with recovery suggestions
- [ ] **UX-R04:** Use `EmptyState` component consistently in all tables
- [ ] **UX-R05:** Add keyboard navigation for table rows — focusable/navigable via keyboard
- [ ] **UX-R06:** Add ARIA labels to DatePicker calendar trigger buttons
- [ ] **UX-R07:** Add colorblind-accessible patterns/labels to charts
- [ ] **UX-R08:** Add export progress feedback for large datasets
- [ ] **UX-R09:** Add undo capability — toast with undo button for voids/archives
- [ ] **UX-R10:** Fix import preview — indicate when there are more than 50 rows
- [ ] **UX-R11:** Persist expanded product rows on Inventory page reload

---

## Summary

| Phase | Items | Priority | Effort |
|-------|:-----:|----------|--------|
| 8: Remove Utang | 12 | 🔴 High | Medium — touches many files but straightforward |
| 9: Business Logic & Security | 8 | 🔴 High | Medium — critical for production safety |
| 10: Performance | 6 | 🟠 Medium | High — N+1 requires SQL rewriting |
| 11: Code Quality | 19 | 🟡 Medium | High — refactoring across many files |
| 12: Styling | 7 | 🟡 Low-Med | Low — mostly small tweaks |
| 13: UI/UX Polish | 11 | 🟢 Low | Medium — cosmetic improvements |
| **Total** | **63** | | |
