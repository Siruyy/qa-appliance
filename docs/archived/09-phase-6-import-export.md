# Phase 6 — Import / Export

## Goal
Allow the owner to bulk-import initial data (products, customers, existing balances) using Excel templates, and export the full database to Excel for backup or sharing with an accountant.

---

## Screen: Import / Export Page (`/import-export`)

```
[Import / Export]
────────────────────────────────────────────────────────────────

  EXPORT DATA
  ────────────────────────────────────────────────────────────
  Download a full export of your data for backup or analysis.

  [↓ Export All Data (Excel)]      ← All tables in one workbook, multiple sheets
  [↓ Export Products & Inventory]  ← products + variants + stock
  [↓ Export Customers]             ← customer list
  [↓ Export Accounts & Balances]   ← all installment accounts + status
  [↓ Export Payments History]      ← all payment transactions

  ────────────────────────────────────────────────────────────
  IMPORT DATA
  ────────────────────────────────────────────────────────────
  Use our templates to import data. Download a template, fill it in,
  then upload it here.

  PRODUCTS & INVENTORY
  [↓ Download Template]   [↑ Upload File]   [?]

  CUSTOMERS
  [↓ Download Template]   [↑ Upload File]   [?]

  OPEN BALANCES (Existing Utang/Installment)
  [↓ Download Template]   [↑ Upload File]   [?]

  ────────────────────────────────────────────────────────────
  IMPORT HISTORY (last 5 imports)
  2026-04-04 10:23am  Products import  → 42 rows added, 0 errors
  2026-04-03 2:10pm   Customers import → 18 rows added, 2 errors  [View Errors]
```

---

## Export Functionality

### Full Data Export (`export_all`)
Generates an Excel workbook with these sheets:
1. `Products` — all active products + variants
2. `Categories` — all categories
3. `Customers` — all customers
4. `Sales` — completed sales with items summary
5. `Accounts` — all installment accounts
6. `Payments` — all payment records

- [x] Rust command: `export_all_data()` returns JSON data, frontend uses xlsx library to create workbook
- [x] Frontend uses `toExcel()` utility for file generation/download
- [x] 6 export commands: products, customers, sales, accounts, payments, all

### Scoped Exports

- [x] `export_products_data()` — products + variants with parsed attributes
- [x] `export_customers_data()` — all customers with active status
- [x] `export_sales_data(start_date?, end_date?)` — sales with items summary
- [x] `export_accounts_data()` — accounts + schedule summary
- [x] `export_payments_data(start_date?, end_date?)` — filtered payments

All export operations: Rust queries SQLite → returns JSON → frontend formats with xlsx library → browser download.

---

## Import Functionality

### Import Template Format

Templates use column headers documented below. User creates an Excel file matching these headers.

#### Products Template

| Column | Required | Notes |
|--------|----------|-------|
| `category` | Yes | Must match an existing category name — or will be created |
| `product_name` | Yes | Parent product name |
| `variant_color` | No | e.g., "White", "Black", "Silver" |
| `variant_size` | No | e.g., "350L", "1.5HP", "7kg" |
| `sku` | No | Optional SKU code |
| `cost_price` | Yes | Number only (no ₱ symbol) |
| `selling_price` | Yes | Number only |
| `stock_qty` | Yes | Integer |
| `low_stock_threshold` | No | Default: 2 |

**Import logic:**
1. Parse each row
2. Find or create the category by name
3. Find or create the product by `(category_id, product_name)`
4. Find or create the variant by `(product_id, attributes JSON)`
5. If variant exists: UPDATE stock_qty and prices
6. If variant is new: INSERT it

#### Customers Template

| Column | Required | Notes |
|--------|----------|-------|
| `name` | Yes | Full name |
| `phone` | No | |
| `address` | No | |
| `notes` | No | |

**Import logic:**
1. Check for duplicate by exact name + phone match
2. If duplicate: skip (report as skipped, not error)
3. If new: INSERT

#### Open Balances Template

Used for migrating existing utang/installment accounts from a previous spreadsheet.

| Column | Required | Notes |
|--------|----------|-------|
| `customer_name` | Yes | Must match an existing customer (or will create one) |
| `customer_phone` | No | Used for matching if name not unique |
| `product_description` | Yes | Free text — what they bought (stored in sale notes) |
| `original_amount` | Yes | Full purchase price |
| `balance_remaining` | Yes | What they currently owe |
| `interest_rate` | No | Default 0 |
| `penalty_rate` | No | Default 0 |
| `has_schedule` | No | `yes`/`no` — default `no` (open utang) |
| `term_months` | No | Required if `has_schedule = yes` |
| `monthly_amount` | No | If provided with schedule |
| `start_date` | No | `YYYY-MM-DD` |
| `notes` | No | |

**Import logic:**
- [x] Creates synthetic `sales` record with `notes = 'Migrated from import: <product_description>'`
- [x] Creates `installment_accounts` with balance set from `balance_remaining`
- [x] If has_schedule=yes, generates payment_schedules
- [x] If down_payment > 0, creates initial down_payment record

---

## Import Validation & Error Reporting

Every import goes through a two-step process:

### Step 1: Preview (Dry Run)
- [x] Parse the uploaded file via calamine crate
- [x] Validate every row per template rules
- [x] Show preview dialog: valid rows (green tab), error rows (red tab), skipped rows (yellow tab)
- [x] User reviews before confirming
- [x] Summary cards: X valid | Y errors | Z skipped | Total

### Step 2: Confirm Import
- [x] Only import rows that passed validation
- [x] Skip errored rows
- [x] Show final toast: `N added, N skipped, N errors`
- [x] Store import log in `import_logs` table for history

### Validation Rules Per Template

**Products:**
- [x] `cost_price` and `selling_price` must be valid non-negative numbers
- [x] `stock_qty` must be a non-negative integer
- [x] `product_name` and `category` must not be empty after trim

**Customers:**
- [x] `name` must not be empty after trim
- [x] Duplicate detection by name + phone

**Balances:**
- [x] `original_amount` and `balance_remaining` must be valid numbers
- [x] `balance_remaining` must not exceed `original_amount`
- [x] `customer_name` must not be empty
- [x] If `has_schedule = yes`: `term_months` must be a positive integer

---

## Template Downloads

Note: Templates are described by column headers shown in the UI via badges. Users create their own Excel files matching the expected column headers.

---

## Import Log Table (added to schema)

```sql
-- Added in V2 migration
CREATE TABLE IF NOT EXISTS import_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  import_type TEXT NOT NULL,      -- 'products' | 'customers' | 'balances'
  filename    TEXT NOT NULL,
  rows_added  INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  rows_errored INTEGER NOT NULL DEFAULT 0,
  error_details TEXT,             -- JSON array of { row, message }
  imported_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Rust: Commands (`src-tauri/src/commands/import_export.rs`)

- [x] `export_all_data()` → ExportAllData (products, categories, customers, sales, accounts, payments)
- [x] `export_products_data()` → Vec<ExportProduct> (with parsed variant attributes)
- [x] `export_customers_data()` → Vec<ExportCustomer>
- [x] `export_sales_data(start_date?, end_date?)` → Vec<ExportSale>
- [x] `export_accounts_data()` → Vec<ExportAccount>
- [x] `export_payments_data(start_date?, end_date?)` → Vec<ExportPayment>
- [x] `preview_import(import_type, file_path)` → ImportPreview { valid_rows, error_rows, skip_rows }
- [x] `confirm_import(import_type, file_path)` → ImportResult { rows_added, rows_skipped, rows_errored }
- [x] `list_import_logs(limit?)` → Vec<ImportLog>

**Excel parsing:** calamine crate reads .xlsx files in Rust. 53 total registered commands.

---

## Frontend Components

- [x] `ImportExportPage.tsx` — Full page with ExportSection, ImportSection, ImportHistory
  - ExportSection: 6 export cards (products, customers, sales, accounts, payments, all)
  - ImportSection: type selector + file picker via @tauri-apps/plugin-dialog + preview button
  - ImportPreviewDialog: tabs for valid/error/skip rows with summary cards
  - ImportHistory: table of past imports with counts
- [x] `useImportExport.ts` — Invoke wrappers for all 9 commands
- [x] `importExportStore.ts` — Zustand store for import workflow state

---

## Phase 6 Implementation Notes

- Exports return JSON from Rust → frontend uses existing `toExcel()` utility
- File open dialog via `@tauri-apps/plugin-dialog` (npm + Rust plugin)
- calamine crate v0.26 for Excel reading in Rust
- No chrono dependency — date helpers use same civil_from_days algorithm as penalty service
- Product import: find-or-create category → product → variant; update existing variants
- Customer import: duplicate detection by name+phone, skip duplicates as "skipped" not "error"
- Balance import: creates synthetic sale + installment_account + optional payment_schedules + down_payment record
- All imports are non-atomic per row (individual row failures logged, don't block other rows)

---

## Phase 6 Sign-off Checklist

- [x] All 6 export types produce valid Excel files via toExcel utility
- [x] Products import processes correctly (creates categories, products, variants)
- [x] Duplicate products update stock instead of creating duplicates
- [x] Customers import skips exact duplicates
- [x] Balances import creates synthetic sales + accounts with correct balances
- [x] Import preview shows correct counts before confirmation
- [x] Error rows are shown clearly with reason
- [x] Import log records all import history
- [x] No TypeScript errors
- [x] No Rust compilation errors
