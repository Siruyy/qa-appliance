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
7. `Settings` — current app settings

- [ ] Rust command: `export_all_data() → Vec<u8>` (binary XLSX) or saves to file dialog path
- [ ] Frontend triggers Tauri file save dialog, user picks destination
- [ ] Use `@tauri-apps/plugin-dialog` `save()` for file path selection
- [ ] Use `@tauri-apps/plugin-fs` for writing file to disk

### Scoped Exports

- [ ] `export_products() → file` — products + variants sheet only
- [ ] `export_customers() → file` — customers sheet only
- [ ] `export_accounts() → file` — accounts + schedule summary sheet
- [ ] `export_payments(from_date, to_date) → file` — filtered payments

All export operations performed in Rust using direct SQLite queries → serialize to CSV bytes → frontend writes to disk via Tauri FS plugin.

---

## Import Functionality

### Import Template Format

Templates are pre-formatted Excel files bundled with the app (stored in `src-tauri/resources/`).

#### Products Template (products_template.xlsx)

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

#### Customers Template (customers_template.xlsx)

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

#### Open Balances Template (balances_template.xlsx)

Used for migrating existing utang/installment accounts from a previous spreadsheet.

| Column | Required | Notes |
|--------|----------|-------|
| `customer_name` | Yes | Must match an existing customer (or will create one) |
| `customer_phone` | No | Used for matching if name not unique |
| `product_description` | Yes | Free text — what they bought (no inventory link required) |
| `original_amount` | Yes | Full purchase price |
| `balance_remaining` | Yes | What they currently owe |
| `interest_rate` | No | Default from settings |
| `penalty_rate` | No | Default from settings |
| `has_schedule` | No | `yes`/`no` — default `no` (open utang) |
| `term_months` | No | Required if `has_schedule = yes` |
| `monthly_amount` | No | If provided with schedule |
| `start_date` | No | `YYYY-MM-DD` |
| `notes` | No | |

**Import logic:**
- These create `installment_accounts` WITHOUT a corresponding `sales` record
- A synthetic `sales` record is created with `notes = 'Migrated from import'` and `payment_type = 'installment'`
- Balance is set directly from the `balance_remaining` column

---

## Import Validation & Error Reporting

Every import goes through a two-step process:

### Step 1: Preview (Dry Run)
- [ ] Parse the uploaded file
- [ ] Validate every row
- [ ] Show a preview table: rows that will be added (green), rows with errors (red), rows that will be skipped (gray)
- [ ] User reviews the preview before confirming the import
- [ ] Display: `X rows will be added | Y rows have errors | Z rows will be skipped`

### Step 2: Confirm Import
- [ ] Only import rows that passed validation
- [ ] Skip errored rows
- [ ] Show final summary: `42 rows added, 0 errors`
- [ ] Store import log in a `import_logs` table for history

### Validation Rules Per Template

**Products:**
- `cost_price` and `selling_price` must be valid non-negative numbers
- `stock_qty` must be a non-negative integer
- `product_name` and `category` must not be empty after trim

**Customers:**
- `name` must not be empty after trim
- `phone` if provided must be valid format

**Balances:**
- `original_amount` and `balance_remaining` must be valid numbers
- `balance_remaining` must not exceed `original_amount`
- `customer_name` must not be empty
- If `has_schedule = yes`: `term_months` must be a positive integer and `monthly_amount` must be provided

---

## Template Downloads

Templates are bundled with the app at build time (`src-tauri/resources/templates/`).

- [ ] `products_template.xlsx` — with headers + example row + data validation on price columns
- [ ] `customers_template.xlsx` — with headers + example row
- [ ] `balances_template.xlsx` — with headers + example row + column notes

**Frontend:** Clicking "Download Template" triggers `invoke('download_template', { name: 'products' })` which copies the bundled file to a user-chosen path.

---

## Import Log Table (added to schema)

```sql
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

- [ ] `export_all_data(file_path: String) → Result<(), String>`
- [ ] `export_products(file_path: String) → Result<(), String>`
- [ ] `export_customers(file_path: String) → Result<(), String>`
- [ ] `export_accounts(file_path: String) → Result<(), String>`
- [ ] `export_payments(file_path: String, from_date: Option<String>, to_date: Option<String>) → Result<(), String>`
- [ ] `download_template(template_name: String, file_path: String) → Result<(), String>`
- [ ] `preview_import(import_type: String, file_path: String) → ImportPreview`
  - Returns: `{ valid_rows: Vec<Row>, error_rows: Vec<ErrorRow>, skip_rows: Vec<SkipRow> }`
- [ ] `confirm_import(import_type: String, file_path: String) → ImportResult`
  - Actually performs the import (only valid rows)
  - Inserts into `import_logs`

**Note:** File parsing (Excel → rows) done in Rust using the `calamine` crate for reading Excel files.

```toml
# Add to Cargo.toml
calamine = "0.24"
```

---

## Frontend Components

- [ ] `ImportExportPage.tsx`: full page with export section + import section
- [ ] `ImportSection.tsx`: per-template block with download + upload + preview
- [ ] `ImportPreviewModal.tsx`: shows valid/error/skip rows before confirming
- [ ] `ImportHistoryTable.tsx`: last N import logs

---

## Phase 6 Sign-off Checklist

- [ ] All 5 export types download valid Excel files
- [ ] Templates download correctly with example rows
- [ ] Products import processes correctly (creates categories, products, variants)
- [ ] Duplicate products update stock instead of creating duplicates
- [ ] Customers import skips exact duplicates
- [ ] Balances import creates synthetic sales + accounts with correct balances
- [ ] Import preview shows correct counts before confirmation
- [ ] Error rows are shown clearly with reason
- [ ] Import log records all import history
- [ ] No TypeScript errors
