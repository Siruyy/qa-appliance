# Phase 5 — Reports & Analytics

## Goal
6 distinct report types, each with date range filtering, tabular data display, charts where applicable, and export to Excel, PDF, and CSV.

---

## Reports Page Layout (`/reports`)

```
[Reports & Analytics]
──────────────────────────────────────────────────────────────
  [Sales Summary]  [Receivables]  [Inventory]  [Collections]  [Customer History]  [Profit & Loss]
  ─────── Tab navigation ───────────────────────────────────────
  [Date Range: from ____] [to ____]  [Customer ▾]   [Export: Excel | PDF | CSV]
  ──────────────────────────────────────────────────────────────
  [Report Content Area]
```

- Tab-based navigation between report types
- Date range filter applies to all time-based reports
- Export buttons always visible — they export the **currently active report** with current filters
- Export uses the data already loaded in state (no re-fetch needed for export)

---

## Report 1: Sales Summary

**Purpose:** How much was sold in a period, broken down by type.

**Filters:** Date range

**Display:**
```
SALES SUMMARY  |  Apr 1 – Apr 4, 2026
──────────────────────────────────────────────
KPI Row:
  Total Sales: ₱ 145,000   |  Transactions: 8  |  Cash: ₱ 56,500  |  Installment: ₱ 88,500

Line Chart: Daily sales totals (x=day, y=amount sold)

Detail Table:
  Date         | Customer       | Items              | Total       | Type
  Apr 4, 2026  | Maria Santos   | Samsung Ref (×1)   | ₱ 20,500   | Installment
  Apr 4, 2026  | Walk-in        | Extension Cord ×3  | ₱    750   | Cash
  ...
```

**Rust Query:**
```sql
SELECT
  s.id, s.sale_date, c.name as customer_name,
  GROUP_CONCAT(pv_name, ', ') as items_summary,
  s.total, s.payment_type, s.status
FROM sales s
LEFT JOIN customers c ON c.id = s.customer_id
LEFT JOIN sale_items si ON si.sale_id = s.id
LEFT JOIN product_variants pv ON pv.id = si.variant_id
WHERE s.sale_date BETWEEN :from AND :to
  AND s.status = 'completed'
GROUP BY s.id
ORDER BY s.sale_date DESC
```

- [ ] Rust command: `get_sales_summary(from_date: String, to_date: String) → SalesSummaryReport`
- [ ] TypeScript type: `SalesSummaryReport` with `kpis`, `daily_totals[]`, `sales[]`
- [ ] Frontend: KPI cards + Recharts `<LineChart>` + detail table

---

## Report 2: Receivables

**Purpose:** Who owes money, how much, and how overdue.

**Filters:** Status (All / Overdue / Open / Paid), optional customer search

**Display:**
```
RECEIVABLES REPORT
──────────────────────────────────────────────────────────────
KPI Row:
  Total Outstanding: ₱ 438,500  |  Overdue: ₱ 62,000 (14%)  |  Open Accounts: 23

Pie Chart: Outstanding balance split by status (overdue vs current)

Table:
  Customer     | Products         | Balance      | Type        | Days Overdue | Status
  Maria Santos | Samsung Ref      | ₱ 12,500.00  | Installment | 3 days       | [OVERDUE]
  Juan Cruz    | LG Aircon        | ₱  6,000.00  | Utang       | —            | [OPEN]
  ...
  ──────────────────────────────────────────────────────────
  TOTAL:                           ₱ 18,500.00
```

- [ ] Rust command: `get_receivables_report(status_filter: Option<String>) → ReceivablesReport`
  ```sql
  SELECT
    ia.id, c.name, ia.balance_remaining, ia.has_schedule, ia.status,
    MIN(ps.due_date) as earliest_overdue_date,
    GROUP_CONCAT(p.name, ', ') as products
  FROM installment_accounts ia
  JOIN customers c ON c.id = ia.customer_id
  LEFT JOIN payment_schedules ps ON ps.account_id = ia.id AND ps.status = 'overdue'
  LEFT JOIN sales s ON s.id = ia.sale_id
  LEFT JOIN sale_items si ON si.sale_id = s.id
  LEFT JOIN product_variants pv ON pv.id = si.variant_id
  LEFT JOIN products p ON p.id = pv.product_id
  WHERE ia.status != 'paid'
  GROUP BY ia.id
  ```
- [ ] TypeScript type: `ReceivablesReport` with `kpis`, `status_breakdown`, `accounts[]`
- [ ] Frontend: KPI cards + Recharts `<PieChart>` + sortable table

---

## Report 3: Inventory Valuation

**Purpose:** Current stock levels and value.

**Filters:** Category, Status (Active / Low Stock / Out of Stock / All)

**Display:**
```
INVENTORY VALUATION
──────────────────────────────────────────────────────────────
KPI Row:
  Total Retail Value: ₱ 1,230,000  |  Total Cost Value: ₱ 890,000  |  Gross Margin: 28%
  Items in Stock: 47  |  Low Stock: 5  |  Out of Stock: 2

Bar Chart: Stock level by category

Table:
  Product              | Variant     | SKU   | Stock | Cost      | Selling   | Cost Value   | Status
  Samsung Ref RT50K    | White 350L  | SR01W | 3     | ₱ 15,000 | ₱ 20,500 | ₱  45,000   | OK
  LG Aircon 1.5HP      | Standard    | LA15  | 0     | ₱ 12,000 | ₱ 18,000 | ₱       0   | [OUT OF STOCK]
  ...
  ──────────────────────────────────────────────────────────────────────────────────────────
  TOTALS:                                                           Cost: ₱ 890,000
                                                                    Retail: ₱ 1,230,000
```

- [ ] Rust command: `get_inventory_valuation_report(category_id: Option<i64>) → InventoryReport`
- [ ] TypeScript type: `InventoryReport` with `kpis`, `by_category[]`, `items[]`
- [ ] Frontend: KPI cards + Recharts `<BarChart>` + detail table

---

## Report 4: Payment Collections

**Purpose:** How much cash was collected in a period.

**Filters:** Date range, customer search, payment type filter

**Display:**
```
PAYMENT COLLECTIONS  |  Apr 1 – Apr 4, 2026
──────────────────────────────────────────────────────────────
KPI Row:
  Total Collected: ₱ 28,000  |  Transactions: 12  |  Cash Payments: ₱ 24,000  |  Penalties: ₱ 4,000

Bar Chart: Collections by day

Table:
  Date         | Customer     | Account/Product  | Amount       | Type
  Apr 4, 2026  | Maria Santos | Samsung Ref      | ₱  2,000.00  | Payment
  Apr 3, 2026  | Juan Cruz    | LG Aircon        | ₱    250.00  | Penalty
  ...
  ──────────────────────────────────────────────────────────
  TOTAL COLLECTED:                                ₱ 2,250.00
```

- [ ] Rust command: `get_collections_report(from_date: String, to_date: String, customer_id: Option<i64>) → CollectionsReport`
- [ ] TypeScript type: `CollectionsReport` with `kpis`, `daily_totals[]`, `payments[]`
- [ ] Frontend: KPI cards + bar chart + detail table

---

## Report 5: Customer Transaction History

**Purpose:** Full financial history for a specific customer.

**Filters:** Customer (required — searchable dropdown), Date range (optional)

**Display:**
```
CUSTOMER HISTORY  |  Maria Santos
──────────────────────────────────────────────────────────────
Customer: Maria Santos | 09171234567 | Tondo, Manila

KPIs: Total Purchased: ₱ 38,500  |  Total Paid: ₱ 26,000  |  Balance: ₱ 12,500

SALES
  Apr 1, 2026  | Samsung Ref 350L (×1)          | ₱ 20,500 | Installment
  Mar 5, 2026  | LG Aircon 1.5HP (×1)           | ₱ 18,000 | Installment

PAYMENTS
  Apr 4, 2026  | ₱ 2,000.00  | Payment   | Account: Samsung Ref
  Apr 1, 2026  | ₱ 1,000.00  | Down Pay  | Account: Samsung Ref
  Mar 10, 2026 | ₱ 2,000.00  | Payment   | Account: LG Aircon
```

- [ ] Rust command: `get_customer_history_report(customer_id: i64, from_date: Option<String>, to_date: Option<String>) → CustomerHistoryReport`
- [ ] TypeScript type: `CustomerHistoryReport`
- [ ] Frontend: customer selector + KPI cards + sales list + payments list
- [ ] This report's export is useful as a customer statement (especially PDF format)

---

## Report 6: Profit & Loss

**Purpose:** Revenue vs cost of goods sold = gross profit.

**Filters:** Date range

**Formula:**
```
Revenue      = SUM of sale_items.subtotal WHERE sale.status = 'completed'
COGS         = SUM of (sale_items.quantity × variant.cost_price at time of sale*)
Gross Profit = Revenue - COGS
Gross Margin = (Gross Profit / Revenue) × 100
```

> *Note: `cost_price` is NOT snapshotted in `sale_items` — we read current `product_variants.cost_price`. If price changes later, historical P&L will shift. This is acceptable for a simple system. A future improvement would be to snapshot cost at time of sale.

**Display:**
```
PROFIT & LOSS  |  Apr 1 – Apr 30, 2026
──────────────────────────────────────────────────────────────
Revenue:         ₱ 145,000.00
Cost of Goods:   ₱ 105,000.00
─────────────────────────────
Gross Profit:    ₱  40,000.00
Gross Margin:        27.6%

Revenue per Category:
  Refrigerators:    ₱ 82,000 (56.6%)
  Air Conditioners: ₱ 36,000 (24.8%)
  Washing Machines: ₱ 27,000 (18.6%)

Bar Chart: Revenue vs COGS by category
```

- [ ] Rust command: `get_profit_loss_report(from_date: String, to_date: String) → ProfitLossReport`
- [ ] TypeScript type: `ProfitLossReport` with `revenue`, `cogs`, `gross_profit`, `margin`, `by_category[]`
- [ ] Frontend: KPI row + Recharts `<BarChart>` grouped + by-category table

---

## Export Implementation (`src/lib/export/`)

### Excel Export (`toExcel.ts`)
- [ ] Use `xlsx` library
- [ ] Each report generates a workbook with:
  - Sheet 1: Summary (KPIs as key-value rows)
  - Sheet 2: Detail table (all rows)
- [ ] Column widths auto-sized (use xlsx `!cols` options)
- [ ] Currency columns formatted as `#,##0.00`
- [ ] File saved via Tauri's file save dialog (`save()` from `@tauri-apps/plugin-dialog`)

### PDF Export (`toPdf.ts`)
- [ ] Use `jsPDF` with `jspdf-autotable`
- [ ] Header: Store name, report title, date range, generated date
- [ ] KPI summary section
- [ ] Auto-table for detail rows
- [ ] Footer: page numbers
- [ ] Landscape for wide tables, portrait for narrow ones

### CSV Export (`toCsv.ts`)
- [ ] Plain CSV — headers + rows
- [ ] UTF-8 BOM prefix for proper Excel encoding (`\uFEFF`)
- [ ] Dates formatted as `YYYY-MM-DD`
- [ ] Numbers unformatted (no currency symbol) for clean import into other tools

---

## TypeScript Types (`src/types/report.ts`)

- [ ] Define all report type interfaces (or union):
  ```typescript
  export interface ReportKPI {
    label: string
    value: string | number
    type: 'currency' | 'number' | 'percent'
  }

  // Report-specific types defined per report above
  ```

---

## Rust: Commands (`src-tauri/src/commands/reports.rs`)

- [ ] Register all 6 report commands in `main.rs`
- [ ] Each returns a specific typed struct (not a generic JSON blob)
- [ ] All queries use parameterized inputs (no string interpolation — SQL injection prevention)

---

## Phase 5 Sign-off Checklist

- [ ] All 6 reports render with correct data
- [ ] Date range filter correctly filters all time-based reports
- [ ] Sales Summary chart shows correct daily breakdown
- [ ] Receivables shows correct outstanding balances and overdue flags
- [ ] Inventory shows correct stock × price valuations
- [ ] Collections shows all payment types including penalties
- [ ] Customer history works per customer and shows complete record
- [ ] P&L shows correct gross profit and margin
- [ ] Excel export downloads a valid `.xlsx` file
- [ ] PDF export downloads a correctly formatted report
- [ ] CSV export downloads valid UTF-8 CSV
- [ ] All SQL queries use parameterized inputs (security)
- [ ] No TypeScript errors
