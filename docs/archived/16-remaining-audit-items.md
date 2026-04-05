# Remaining Audit Items — Phase 8+

> **Date:** April 5, 2026
> **Scope:** All remaining items from `docs/15-comprehensive-audit.md` plus utang removal
> **Predecessor:** Phases 1-7 complete (74 items done)

---

## Phase 8: Remove Utang & Simplify Payment Model

> Payment can only be **cash** or **installment**. Remove all "utang" / "open credit" / "open-ended" concepts.
> Installments always have a payment schedule (`has_schedule` is always `1`).

- [x] **UTG-01:** Remove `AccountType = "installment" | "utang"` from `src/types/account.ts`
- [x] **UTG-02:** Remove `has_schedule` toggle from `InstallmentConfigPanel.tsx` — always true
- [x] **UTG-03:** Remove "Utang" filter option from `AccountsPage.tsx` type filter dropdown
- [x] **UTG-04:** Remove "Utang" label from `AccountsPage.tsx` table, `AccountDetailPage.tsx`, `AccountMiniCard.tsx`
- [x] **UTG-05:** Remove `"utang"` from `accountStore.ts` type filter logic
- [x] **UTG-06:** Remove `"utang"` branch from `accounts.rs` backend filter
- [x] **UTG-07:** Remove "open-ended" fallback text from `ScheduleTable.tsx`
- [x] **UTG-08:** Clean up `penalty.rs` — remove `has_schedule` branching (always has schedule)
- [x] **UTG-09:** Clean up `sales.rs` — remove `has_schedule` branching, always generate schedule
- [x] **UTG-10:** Update `NewSalePage.tsx` button label from "Installment (Utang)" to "Installment"
- [x] **UTG-11:** Update `.github/copilot-instructions.md` — remove "Installment vs Utang" section
- [x] **UTG-12:** Update `import_export.rs` — simplify `has_schedule` handling in import/export

---

## Phase 9: Critical Business Logic & Security

- [x] **BIZ-R01:** Fix `useMemo` stale closure in `NewSalePage.tsx` — `schedulePreview` has missing dependencies
- [x] **BIZ-R02:** Validate `unit_price` server-side in `sales.rs` — prevent client-side price manipulation
- [x] **BIZ-R03:** Void sale should verify payment balance integrity before voiding
- [x] **BIZ-R04:** Add `min="0"` enforcement on interest/penalty rate inputs in Settings
- [x] **BIZ-R05:** Handle deleted customer in cart — `saleStore.customerId` could reference archived customer
- [x] **SEC-R01:** Add Tauri command allowlist validation in `invoke.ts`
- [x] **SEC-R02:** Sanitize error logging — ensure full error objects don't leak in production builds
- [x] **SEC-R03:** Add SQLite date format validation via application-level checks on date fields

---

## Phase 10: Performance Optimization

- [x] **PERF-R01:** Fix N+1 queries in `get_products` — use JOINs with `GROUP_CONCAT`/`JSON_GROUP_ARRAY`
- [x] **PERF-R02:** Fix N+1 patterns in `get_accounts`, `get_customer_by_id`, `get_sale_by_id`
- [x] **PERF-R03:** Memoize `TopBar.tsx` date formatting with `useMemo`
- [x] **PERF-R04:** Cache `saleStore.cartSubtotal()` result to avoid double calculation in `cartTotal()`
- [x] **PERF-R05:** Add report caching layer — same parameters shouldn't re-fetch
- [x] **PERF-R06:** Add progress tracking to `exportAllData()`

---

## Phase 11: Code Quality & Maintainability

- [x] **CQ-R01:** Extract DRY query builder helper in Rust — shared WHERE clause + COUNT + data pattern
- [x] **CQ-R02:** Fix silent error swallowing — `rows.filter_map(|r| r.ok())` should log/fail-fast
- [x] **CQ-R03:** Improve variable naming — `count_params`/`count_refs` → descriptive names
- [x] **CQ-R04:** Fix `useSales` — use proper error extraction instead of `String(err)`
- [x] **CQ-R05:** _(deferred — low impact)_ Extract shared search/filter logic from stores to `lib/filterUtils.ts`
- [x] **CQ-R06:** _(deferred — low impact)_ Retype `AppSettings` — use properly typed object instead of string map
- [x] **CQ-R07:** Add `useCallback` to mutation functions in hooks
- [x] **CQ-R08:** _(deferred — low impact)_ Convert `useImportExport` to proper hook or move to `lib/` utility
- [x] **CQ-R09:** _(deferred — low impact)_ Split `saleStore` into `saleListStore` and `cartStore`
- [x] **CQ-R10:** _(deferred — low impact)_ Split large page components — `ImportExportPage` (722 lines), `NewSalePage`, `InventoryPage`
- [x] **CQ-R11:** Fix `RecordPaymentPayload` missing `type` field
- [x] **CQ-R12:** Fix `PaymentScheduleEntry.status` — reference `ScheduleStatus` instead of redefining
- [x] **CQ-R13:** _(deferred — cosmetic only)_ Standardize naming — `stock_qty` vs `stock_quantity`
- [x] **CQ-R14:** _(deferred — low impact)_ Add shared types — `ApiError`, `SortOptions`/`FilterOptions` generics
- [x] **CQ-R15:** _(deferred — low impact)_ Add `ProductVariant.attributes` schema validation
- [x] **CQ-R16:** _(deferred — low impact)_ Store-level pagination — apply slicing in `filteredX()` methods
- [x] **CQ-R17:** Fix dependency array risks in `useAccounts`, `usePayments`, `useSales`
- [x] **CQ-R18:** _(deferred — nice-to-have)_ Add JSDoc to hooks and store methods
- [x] **CQ-R19:** _(deferred — nice-to-have)_ Fix full refetch after mutations — implement targeted refetch or optimistic updates

---

## Phase 12: Styling & Theme

- [x] **STY-R01:** _(verified — already consistent)_ Fix sidebar active link — replace inline `border-l-[3px]` with standardized active class
- [x] **STY-R02:** Fix PDF export header color — use theme primary instead of hardcoded `[37, 99, 235]`
- [x] **STY-R03:** Fix PDF brand name — read "Quality Appliance" from settings store
- [x] **STY-R04:** _(deferred — documentation only)_ Document button size hierarchy — when to use `size="sm"` vs default
- [x] **STY-R05:** _(verified — p-6 already at AppShell level)_ Standardize page padding — consistent `p-6` across all pages
- [x] **STY-R06:** _(verified — all callers use useCurrency hook)_ Consolidate currency formatting — deprecate `formatCurrency()` in favor of `useCurrency()` hook
- [x] **STY-R07:** _(verified — font smoothing is standard practice)_ Remove obsolete font smoothing properties from `globals.css`

---

## Phase 13: UI/UX Polish

- [x] **UX-R01:** Standardize loading states — use `TableSkeleton` everywhere instead of "Loading…" text
- [x] **UX-R02:** Add detail page skeletons — `AccountDetailPage`, `CustomerDetailPage`
- [x] **UX-R03:** _(done via extractErrorMessage)_ Improve error messages — user-friendly messages with recovery suggestions
- [x] **UX-R04:** Use `EmptyState` component consistently in all tables
- [x] **UX-R05:** _(deferred — low impact)_ Add keyboard navigation for table rows — focusable/navigable via keyboard
- [x] **UX-R06:** Add ARIA labels to DatePicker calendar trigger buttons
- [x] **UX-R07:** _(deferred — requires chart library changes)_ Add colorblind-accessible patterns/labels to charts
- [x] **UX-R08:** _(deferred — nice-to-have)_ Add export progress feedback for large datasets
- [x] **UX-R09:** _(deferred — nice-to-have)_ Add undo capability — toast with undo button for voids/archives
- [x] **UX-R10:** Fix import preview — indicate when there are more than 50 rows
- [x] **UX-R11:** _(deferred — nice-to-have)_ Persist expanded product rows on Inventory page reload

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
