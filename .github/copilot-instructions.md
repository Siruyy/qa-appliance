# Copilot Instructions — Quality Appliance

## Project Overview

A standalone desktop management system for a physical appliance store (Philippines). Handles inventory, sales (cash + installment/utang/open credit), accounts receivable, payments, and reporting. No internet required — all data lives in a local SQLite file.

**Target:** Windows laptop (minimum 1280×900), build from macOS dev environment.

---

## Commands

```bash
# Start development (Tauri + Vite hot-reload)
npm run tauri dev

# TypeScript type-check (no emit)
npx tsc --noEmit

# Check Rust compilation
cd src-tauri && cargo check

# Build for production
npm run tauri build
```

There is no test suite yet.

---

## Architecture

```
React (TypeScript)  →  invoke()  →  Rust (Tauri Commands)  →  SQLite
```

The frontend **never** accesses SQLite directly. All data goes through Tauri IPC commands (`#[tauri::command]` in Rust). The frontend calls them via:

```typescript
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
```

The project wraps this in `src/lib/invoke.ts` for typed access.

### Tauri Command Contract

Every Rust command returns `Result<T, String>`. On the TypeScript side:
- Resolved → `Promise<T>`
- Rejected → `Promise<string>` (the string is the error message, shown via `toast.error`)

```typescript
try {
  const result = await invoke<Product[]>('get_products')
} catch (error) {
  toast.error(error as string)
}
```

### State Management

Zustand stores (`src/stores/`) hold **read-only snapshots** fetched from Rust. Rules:
- Stores never mutate in place — use immutable spread patterns
- No derived state stored in Zustand — compute with selectors
- Form state is **local** (React Hook Form only, not in Zustand)
- Stores are refreshed by re-invoking the relevant Rust command after mutations

### Path Alias

`@/*` maps to `./src/*` (configured in both `tsconfig.json` and `vite.config.ts`).

---

## Key Conventions

### Type Mirroring (Critical)

TypeScript types in `src/types/` must mirror Rust structs in `src-tauri/src/models/`. Any schema or struct change must be reflected in **both** places.

### Soft Deletes Only

- Products/variants: set `is_active = 0` — never hard delete (protects sale history)
- Customers: set `is_active = 0` — never hard delete (protects account history)
- Sales: set `status = 'voided'` — never delete rows; voiding restores stock quantities

### Penalty Detection (No Background Process)

There is no background thread. Penalty detection runs:
1. On **app startup**
2. When the **Accounts page is opened**

Logic: query overdue accounts → check `last_penalty_date` → if not applied this period, create a `payments` row with `type = 'penalty'` and update `balance_remaining`.

### Interest Calculation — Add-on / Flat Rate

Default is Filipino add-on (flat) interest:
```
total_interest = principal × monthly_rate × term_months
monthly_payment = (principal + total_interest - down_payment) / term_months
```
See `src-tauri/src/services/interest.rs` and `src/lib/interest.ts` for client-side helpers.

### Installment vs Utang

Both use the `installment_accounts` table. The distinction is a single flag:
- `has_schedule = 1` → Installment (fixed monthly payments, `payment_schedules` rows generated)
- `has_schedule = 0` → Utang / Open Credit (no schedule, customer pays ad hoc)

`payment_type` on the `sales` table is always `'cash'` or `'installment'` (utang is modeled as `'installment'`).

### `balance_remaining`

This is a live running balance on `installment_accounts`. It is decremented by every payment and can be recalculated from scratch via the `recalculate_balance` Tauri command if data integrity is in question.

### Currency Display

All amounts display the Philippine Peso symbol `₱`. Use `formatCurrency()` from `src/lib/formatters.ts`. Currency columns are **right-aligned** with `font-variant-numeric: tabular-nums`.

---

## Database

- **Location:** `$APPDATA/quality-appliance/app.db` (Windows: `C:\Users\<user>\AppData\Roaming\quality-appliance\app.db`)
- **Schema init:** `src-tauri/src/db/migrations.rs` — runs `CREATE TABLE IF NOT EXISTS` on first launch, tracks versions in `schema_migrations`
- **Pragmas set on init:** `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON`
- `product_variants.attributes` is stored as a **JSON string** (`{"color": "White", "size": "350L"}`)
- `sale_items.unit_price` is a **price snapshot** — it never changes after the sale is recorded

### Core Table Relationships

```
categories → products → product_variants → sale_items → sales
customers → sales → installment_accounts → payment_schedules
                                         → payments
```

---

## UI Conventions

- **Component library:** shadcn/ui (components in `src/components/ui/` — auto-generated, don't edit manually)
- **Icons:** Lucide React exclusively
- **Layout:** Fixed 240px dark sidebar (`bg: #1E293B`) + fluid main area. No mobile breakpoints needed.
- **Status badges:** Use the `StatusBadge` component (`src/components/status/StatusBadge.tsx`) for all `paid/pending/overdue/partial/defaulted/voided/open` statuses
- **Tables:** Use the shared `DataTable` component (`src/components/tables/DataTable.tsx`) — it handles sort, filter, and empty states
- Alert banners (overdue accounts, low stock) appear at the **top** of their respective pages, not inline

### Page Structure Pattern

Every CRUD page follows this layout:
```
[Page Title + Subtitle]    [Action Buttons — right-aligned]
─────────────────────────────────────────────────────────
[Filter Bar / Search]
─────────────────────────────────────────────────────────
[DataTable]
─────────────────────────────────────────────────────────
[Pagination]
```

Modals are 560px wide (standard forms) or 720px (complex, e.g., New Sale).

---

## Folder Highlights

| Path | Purpose |
|------|---------|
| `src/lib/invoke.ts` | Typed Tauri IPC wrapper — use this, not raw `invoke` |
| `src/lib/formatters.ts` | `formatCurrency`, `formatDate`, `formatDateTime`, `formatPercent` |
| `src/lib/interest.ts` | Add-on interest + penalty calculation helpers |
| `src/lib/export/` | `toExcel.ts`, `toPdf.ts`, `toCsv.ts` |
| `src/types/` | TypeScript types — must stay in sync with `src-tauri/src/models/` |
| `src/stores/` | Zustand stores (read-only snapshots) |
| `src/components/ui/` | shadcn/ui auto-generated — do not hand-edit |
| `src-tauri/src/commands/` | Tauri IPC handlers (one file per domain) |
| `src-tauri/src/services/` | Business logic: `interest.rs`, `penalty.rs`, `schedule.rs` |
| `src-tauri/src/db/migrations.rs` | Full schema creation + seeding |
| `docs/` | Full project spec — read before working on any new module |
