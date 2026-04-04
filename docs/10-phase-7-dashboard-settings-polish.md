# Phase 7 — Dashboard, Settings & Final Polish

## Goal
Build the Dashboard (the first thing the owner sees every day), the Settings screen, and apply final UX polish, error handling, and pre-delivery QA.

---

## Part A: Dashboard (`/dashboard`)

The dashboard is the home screen. It should answer: *"What do I need to know today?"*

### Layout

```
[Quality Appliance]            Saturday, April 4, 2026
────────────────────────────────────────────────────────────────────

  KPI CARDS (4 across)
  ────────────────────────────────────────────────────────────────
  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
  │ Today's Sales    │ │ This Month Sales  │ │ Total Receivables│ │ Overdue Accounts │
  │ ₱ 48,500         │ │ ₱ 320,000         │ │ ₱ 438,500        │ │ 3 accounts       │
  │ 4 transactions   │ │ +12% vs last mo  │ │ 23 open accounts │ │ ₱ 62,000 overdue │
  └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘

  ALERTS
  ────────────────────────────────────────────────────────────────
  ⚠ [OVERDUE] 3 accounts are overdue totaling ₱62,000  [View Accounts →]
  ⚠ [LOW STOCK] 5 products are low or out of stock     [View Inventory →]

  CHARTS (2 columns)
  ────────────────────────────────────────────────────────────────
  ┌─────────────────────────────────┐ ┌───────────────────────────────┐
  │ Sales (Last 30 Days)            │ │ Collections (Last 30 Days)    │
  │ [Line Chart]                    │ │ [Bar Chart]                   │
  └─────────────────────────────────┘ └───────────────────────────────┘

  QUICK TABLES (2 columns)
  ────────────────────────────────────────────────────────────────
  ┌─────────────────────────────────┐ ┌───────────────────────────────┐
  │ Recent Sales (last 5)           │ │ Upcoming Payments Due (5)     │
  │  Apr 4 | Maria Santos | ₱ 20,500│ │  Apr 15 | Maria Santos | ...  │
  │  Apr 4 | Walk-in      | ₱    750│ │  Apr 15 | Juan Cruz   | ...   │
  │  Apr 3 | Juan Cruz    | ₱  2,000│ │  Apr 20 | Ana Reyes   | ...   │
  └─────────────────────────────────┘ └───────────────────────────────┘
```

### Dashboard KPI Data

- [ ] Rust command: `get_dashboard_data() → DashboardData`
  ```rust
  struct DashboardData {
    today_sales_total: f64,
    today_sales_count: i64,
    month_sales_total: f64,
    month_sales_count: i64,
    last_month_sales_total: f64,      // for % change calculation
    total_receivables: f64,
    open_accounts_count: i64,
    overdue_accounts_count: i64,
    overdue_total: f64,
    low_stock_count: i64,
    sales_last_30_days: Vec<DailySales>,     // [{date, total}]
    collections_last_30_days: Vec<DailyCollection>, // [{date, total}]
    recent_sales: Vec<SaleSummary>,          // last 5
    upcoming_due: Vec<UpcomingDue>,          // next 5 payment_schedules by due_date
  }
  ```
- [ ] Single command — all data fetched in one round trip to minimize load time
- [ ] Queries optimized with indexes (already defined in schema)

### Dashboard Alerts

- [ ] Alert component renders dynamically if `overdue_accounts_count > 0`
- [ ] Alert component renders dynamically if `low_stock_count > 0`
- [ ] Each alert has a "View →" link to the relevant page
- [ ] No alerts → shows a clean message "Everything looks good today."

### Dashboard Charts

- [ ] Sales Last 30 Days: Recharts `<LineChart>` with fill area, X=date, Y=₱ amount
- [ ] Collections Last 30 Days: Recharts `<BarChart>`, X=date, Y=₱ collected
- [ ] Both charts use the same X-axis date range for visual alignment
- [ ] Charts handle zero-data gracefully (flat line, no crash)

### TypeScript Type (`src/types/report.ts` addition)
- [ ] `DashboardData` interface matching Rust struct above

---

## Part B: Settings Page (`/settings`)

```
[Settings]
────────────────────────────────────────────────────────────────

  STORE INFORMATION
  ────────────────────────────────────────────────────────────
  Store Name:     [Quality Appliance          ]
  Address:        [____________________________]
  Phone:          [____________________________]

  DEFAULT FINANCIAL SETTINGS
  ────────────────────────────────────────────────────────────
  Default Interest Rate:     [5.00] % per month
  Default Penalty Rate:      [2.00] % on overdue balance
  Default Down Payment:      [20.00] % of total
  Default Term:              [12] months

  INSTALLMENT PRESET TERMS
  ────────────────────────────────────────────────────────────
  Quick-select options shown in New Sale form:
  [3] [6] [12] [18] [24]  months  [+ Add] [× Remove]

  INVENTORY
  ────────────────────────────────────────────────────────────
  Global Low Stock Threshold: [2] units
  (Products use their own threshold if set, otherwise this value)

  CATEGORIES
  ────────────────────────────────────────────────────────────
  [Refrigerators]  [Edit] [Delete]
  [Washing Machines] [Edit] [Delete]
  [Air Conditioners] [Edit] [Delete]
  [+ Add Category]

  DISPLAY
  ────────────────────────────────────────────────────────────
  Currency Symbol: [₱]    (used in all displays + exports)

  ────────────────────────────────────────────────────────────
                                              [Save Changes]
```

### Settings Key-Value Persistence
- All settings values stored in the `settings` table as `key → value` string pairs
- On app load, settings fetched once and cached in `useSettingsStore`
- Saving settings: calls `update_setting(key, value)` for each changed key

### Rust Commands (settings)
- [ ] `get_all_settings() → HashMap<String, String>`
- [ ] `update_setting(key: String, value: String) → ()`
- [ ] `update_settings_batch(pairs: Vec<(String, String)>) → ()` — saves all at once

### TypeScript: Settings Store (`src/stores/settingsStore.ts`)
- [ ] `settings: Record<string, string>`
- [ ] Typed accessors:
  - `defaultInterestRate: number`
  - `defaultPenaltyRate: number`
  - `defaultDownPaymentPct: number`
  - `defaultTermMonths: number`
  - `presetTerms: number[]`
  - `lowStockThreshold: number`
  - `storeName: string`
  - `currencySymbol: string`
- [ ] `loadSettings(): void` — fetches from Rust
- [ ] `updateSetting(key, value): void` — calls Rust + updates local state

---

## Part C: Final Polish

### Toast Notifications
- [ ] Install `sonner` (shadcn's recommended toast library)
- [ ] Add `<Toaster />` in `AppShell.tsx`
- [ ] Standardize toast calls:
  - `toast.success('Sale completed!')` — green
  - `toast.error('Something went wrong: ...')` — red
  - `toast.warning('Penalty applied to 2 accounts')` — amber
- [ ] All Tauri command calls wrapped with try/catch + appropriate toast

### Loading States
- [ ] All data-fetching operations show a loading skeleton or spinner
- [ ] Skeleton component for: KPI cards, tables, account detail
- [ ] Tables use a loading overlay (not a full page spinner) to avoid layout shift
- [ ] Button disabled state + loading spinner while Rust command is in flight

### Empty States
- [ ] Every table must have an empty state:
  - Inventory: "No products yet. Add your first product."
  - Customers: "No customers found."
  - Accounts: "No open accounts. Great work!"
  - Reports: "No data found for the selected date range."

### Error Boundaries
- [ ] Wrap each major page in a React `ErrorBoundary`
- [ ] Fallback UI: "Something went wrong. Please restart the app."
- [ ] Log error to console (Tauri log plugin for writing to file)

### Keyboard Shortcuts (nice to have)
- [ ] `Ctrl+N` → New Sale
- [ ] `Ctrl+,` → Settings
- [ ] `Escape` → Close open modal

### Data Consistency
- [ ] On app startup: run penalty check (Phase 4)
- [ ] On app startup: run `recalculate_balance` on all open accounts with pending balance discrepancies (safety net)

### Window Behavior
- [ ] Prevent accidental close if New Sale is in progress (unsaved cart): show confirm dialog
- [ ] Use Tauri's `onCloseRequested` event for this

---

## Part D: Build & Packaging

### Windows Installer
- [ ] Configure `tauri.conf.json` `bundle` section:
  ```json
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "identifier": "com.qualityappliance.app",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico"],
    "resources": ["resources/templates/*"]
  }
  ```
- [ ] Run `npm run tauri build` targeting Windows
- [ ] Test installer on a fresh Windows machine (or VM)
- [ ] Verify database is created at correct path on first launch
- [ ] Verify auto-updater is disabled (not needed for this project)

### App Icon
- [ ] Create or commission a simple icon for the app
- [ ] Generate all required sizes: 32×32, 128×128, 256×256, .ico
- [ ] Place in `src-tauri/icons/`

---

## Final QA Checklist

### Functional
- [ ] Full sale workflow: cash, installment with schedule, utang without schedule
- [ ] Payment recording correctly updates all related balances
- [ ] Penalty auto-applies and doesn't double-apply
- [ ] All 6 reports show correct data
- [ ] All 3 export formats download correctly
- [ ] All 3 import templates work end-to-end
- [ ] Settings save and persist across app restarts
- [ ] Dashboard loads with correct KPIs

### Edge Cases
- [ ] Sale with zero discount
- [ ] Sale with 100% cash down (installment fully paid upfront)
- [ ] Customer with no sales history
- [ ] Inventory with zero stock
- [ ] Report on a date range with no data
- [ ] Import file with 0 valid rows (all errors)
- [ ] Voiding a cash sale (stock restored)

### Security
- [ ] All SQL queries use parameterized inputs
- [ ] No user input directly interpolated into SQL strings
- [ ] File paths from user are validated before file operations
- [ ] No sensitive data logged to console in production build

### Performance
- [ ] Dashboard loads in < 500ms on cold start
- [ ] Products list with 200+ variants scrolls smoothly
- [ ] Reports with 1 year of data generate in < 2 seconds
- [ ] Excel export with 1000+ rows completes without freezing UI (export runs in Rust thread)

### UX
- [ ] All form validation errors are specific and actionable
- [ ] Date formats consistent across the app
- [ ] Currency formatted consistently (₱ symbol, 2 decimal places, thousands separator)
- [ ] Status badges consistent across all pages (same colors, same text)

---

## Phase 7 Sign-off Checklist

- [ ] Dashboard loads with correct KPIs
- [ ] Alert banners show on overdue/low stock conditions
- [ ] Charts render correctly
- [ ] Settings save and load correctly
- [ ] Category CRUD in settings works
- [ ] All toast notifications appear correctly
- [ ] Loading skeletons show during data fetch
- [ ] Empty states render for all tables
- [ ] Windows installer builds successfully
- [ ] App installs and runs on a fresh Windows machine
- [ ] Database persists correctly across app restarts
- [ ] All final QA checklist items above completed
