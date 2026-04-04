# QA-Appliance — Implementation Plan v2

**Source:** `docs/13-audit-report.md`  
**Objective:** Fix all critical/high/medium bugs and add comprehensive demo seed data.

---

## Task List

| ID | Title | Severity | File(s) |
|---|---|---|---|
| T1 | Fix React hooks violation in AccountDetailPage | Critical | `src/pages/accounts/AccountDetailPage.tsx` |
| T2 | Fix broken IPC command in CustomerHistoryTab | Critical | `src/pages/reports/CustomerHistoryTab.tsx` |
| T3 | Fix penalty check type mismatch in AppShell | High | `src/app/layout/AppShell.tsx` |
| T4 | Fix wrong date field in saleStore filter | High | `src/stores/saleStore.ts` |
| T5 | Fix `cost_price_snapshot` missing in SaleItem type | Medium | `src/types/sale.ts` |
| T6 | Move `useCurrency` to top in RecordPaymentModal | Medium | `src/pages/accounts/RecordPaymentModal.tsx` |
| T7 | Move `useCurrency` to top in ReportsPage | Medium | `src/pages/reports/ReportsPage.tsx` |
| T8 | Move `useCurrency` to top in ImportExportPage | Medium | `src/pages/import-export/ImportExportPage.tsx` |
| T9 | Add V4 migration with comprehensive demo seed data | Required | `src-tauri/src/db/migrations.rs` |

---

## Implementation Details

### T1 — Fix React Hooks Violation in AccountDetailPage

Move `const { format: formatCurrency } = useCurrency();` from after conditional returns to the top of the component function, before any `if (loading)` or `if (!account)` early returns.

---

### T2 — Fix Broken IPC Command in CustomerHistoryTab

Replace:
```tsx
invoke<{ id: number; first_name: string; last_name: string }[]>("list_customers", {
  searchQuery: null,
  isActive: true,
})
.then((list) =>
  setCustomers(list.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}` })))
)
```

With:
```tsx
invoke<{ id: number; name: string }[]>("get_customers", {
  includeArchived: false,
  search: null,
  limit: null,
  offset: null,
})
.then((result) =>
  setCustomers(result.items.map((c) => ({ id: c.id, name: c.name })))
)
```

Note: `get_customers` returns `PaginatedResult<Customer>` — use `.items`.

---

### T3 — Fix Penalty Check Type in AppShell

Change:
```tsx
invoke<number>("run_penalty_check")
  .then((count) => {
    if (count > 0) {
      toast.warning(`${count} penalty/penalties applied`);
    }
  })
```

To:
```tsx
invoke<PenaltyApplied[]>("run_penalty_check")
  .then((applied) => {
    if (applied.length > 0) {
      toast.warning(`${applied.length} penalty/penalties applied to overdue accounts`);
    }
  })
```

Add import for `PenaltyApplied` from `@/types/account`.

---

### T4 — Fix Date Field in saleStore

Change lines 101–102 in `saleStore.ts`:
```ts
if (filters.dateFrom && s.created_at < filters.dateFrom) return false;
if (filters.dateTo && s.created_at > filters.dateTo + "T23:59:59") return false;
```

To:
```ts
if (filters.dateFrom && s.sale_date < filters.dateFrom) return false;
if (filters.dateTo && s.sale_date > filters.dateTo) return false;
```

---

### T5 — Add cost_price_snapshot to SaleItem type

In `src/types/sale.ts`, add to the `SaleItem` interface:
```ts
cost_price_snapshot?: number;
```

---

### T6–T8 — Move useCurrency to Top of Components

In `RecordPaymentModal.tsx`, `ReportsPage.tsx`, and `ImportExportPage.tsx`:
Move the `const { format: formatCurrency } = useCurrency();` declaration to the top of the component/function body, before any callbacks or other code.

---

### T9 — V4 Demo Seed Data Migration

Add a `migrate_v4` function to `migrations.rs` that inserts:

**Categories (8):**
Air Conditioner, Refrigerator, Washing Machine, Television, Kitchen Appliances, Water Heater, Electric Fan, Small Appliances

**Products (~35) with variants (~70):**
- Aircon: Carrier, Kolin, Condura, Panasonic (0.5HP–2.5HP)
- Refrigerator: Samsung, LG, Condura, Panasonic (6cu–20cu ft)
- Washing Machine: Samsung, LG, Condura, Whirlpool
- TV: Samsung, LG, Sony, Panasonic (32"–55")
- Kitchen: rice cooker, microwave, blender, stove
- Water Heater: Ariston, Rheem, Hanabishi
- Fan: stand fan, tower fan, ceiling fan
- Small: iron, hair dryer, vacuum, kettle

**Customers (60):** Filipino names, cellphone numbers (09xx-xxx-xxxx), barangay addresses

**Sales (~350):** Spanning 24 months back from today
- ~60% cash sales (₱1,000–₱25,000)
- ~40% installment sales (₱8,000–₱80,000) with 6/12/18/24 month terms

**Installment Accounts (~120):** Mixed statuses
- ~55% open (active, paying)
- ~20% paid (completed)
- ~15% overdue (missed payments)
- ~10% defaulted

**Payments:** Realistic payment history with dates matching schedule entries

---

## Execution Order

1. T1 (Critical — causes navigation crashes)
2. T2 (Critical — broken feature)
3. T3 (High)
4. T4 (High)
5. T5 + T6 + T7 + T8 (Medium, can batch)
6. T9 (Seed data — largest task)

Commit after each task. Update this file to mark tasks complete as they are done.

---

## Completion Status

- [x] T1 — Fix AccountDetailPage hooks violation
- [x] T2 — Fix CustomerHistoryTab IPC command
- [x] T3 — Fix AppShell penalty check type
- [x] T4 — Fix saleStore date field
- [x] T5 — Fix SaleItem TypeScript type
- [x] T6 — Fix RecordPaymentModal hook position
- [x] T7 — Fix ReportsPage hook position
- [x] T8 — Fix ImportExportPage hook position
- [x] T9 — Add V4 seed data migration
