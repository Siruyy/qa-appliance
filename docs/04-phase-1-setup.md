# Phase 1 — Project Setup & Scaffolding

## Goal
Bootstrap the full Tauri v2 + React + TypeScript project. By the end of this phase, the app launches with a working sidebar, routing, and an initialized SQLite database — no business logic yet.

## Prerequisites
- [x] Rust toolchain installed (`rustup`, stable channel) — Rust 1.93.1
- [x] Node.js 20+ installed — Node v25.3.0
- [x] `cargo install tauri-cli` (v2) — using `npm create tauri-app@latest`
- [x] Confirm target: Windows (primary), build from macOS dev environment

---

## 1. Project Scaffolding

- [x] Run `npm create tauri-app@latest quality-appliance` with options:
  - Frontend: `React`
  - Language: `TypeScript`
  - Package manager: `npm`
- [x] Verify project runs: `npm run tauri dev`
- [x] Rename `src-tauri/tauri.conf.json` app identifier to `com.qualityappliance.app`
- [x] Set `productName` to `"Quality Appliance"` in `tauri.conf.json`
- [x] Set `version` to `"1.0.0"` in `tauri.conf.json`

---

## 2. Frontend Dependencies

- [x] Install UI and utility packages:
  ```bash
  npm install tailwindcss @tailwindcss/vite lucide-react react-router-dom zustand
  npm install react-hook-form @hookform/resolvers zod recharts
  npm install xlsx jspdf jspdf-autotable date-fns clsx tailwind-merge
  npm install @fontsource/inter sonner
  ```
- [x] Install shadcn/ui CLI and initialize:
  ```bash
  npx shadcn@latest init -d
  ```
  > **Note:** shadcn v4 uses `@import "tailwindcss"` CSS-based config (no `tailwind.config.js`). The `-d` flag uses defaults. `--base-color` flag is no longer supported in v4.
- [x] Add shadcn components (16 total):
  ```bash
  npx shadcn@latest add button input label select dialog table badge card separator tooltip sheet scroll-area dropdown-menu tabs textarea checkbox sonner
  ```

---

## 3. Rust Dependencies (`src-tauri/Cargo.toml`)

- [x] Add `rusqlite` with bundled flag (bundles SQLite natively):
  ```toml
  [dependencies]
  rusqlite = { version = "0.31", features = ["bundled"] }
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"
  chrono = { version = "0.4", features = ["serde"] }
  dirs = "5"
  tauri = { version = "2", features = [] }
  ```
- [x] Run `cargo check` inside `src-tauri/` to confirm dependencies resolve

---

## 4. Tailwind & Global Styles

- [x] Configure `vite.config.ts` to use `@tailwindcss/vite` plugin
- [x] Create `src/styles/globals.css` with:
  - Tailwind `@import "tailwindcss"`
  - CSS custom properties from `03-ui-design.md` (colors, font sizes)
  - Base styles: `font-family: 'Inter', sans-serif`
  - Scrollbar styling (subtle, thin)
  - Semantic status colors (success/warning/danger/info)
- [x] Bundle Inter via `@fontsource/inter`
- [x] Import Inter in `src/main.tsx`:
  ```ts
  import '@fontsource/inter/400.css'
  import '@fontsource/inter/500.css'
  import '@fontsource/inter/600.css'
  import '@fontsource/inter/700.css'
  ```

---

## 5. TypeScript Configuration

- [x] Configure `tsconfig.json`:
  - `strict: true`
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - Path aliases: `@/*` → `./src/*`
- [x] Configure `vite.config.ts` with matching path aliases
- [x] Create `src/types/` directory with full type definitions:
  - `product.ts` — Category, Product, ProductVariant, create payloads
  - `customer.ts` — Customer, CreateCustomerPayload
  - `sale.ts` — Sale, SaleItem, PaymentType, SaleStatus, create payloads
  - `account.ts` — InstallmentAccount, AccountStatus, create payload
  - `payment.ts` — Payment, PaymentSchedule, RecordPaymentPayload
  - `report.ts` — DashboardStats, SalesReportRow, CollectionsReportRow
  - `settings.ts` — AppSettings

---

## 6. App Layout & Routing

- [x] Create `src/app/router.tsx` with React Router v6 routes:
  ```
  /             → redirect to /dashboard
  /dashboard    → DashboardPage
  /inventory    → InventoryPage
  /customers    → CustomersPage
  /sales/new    → NewSalePage
  /sales        → SalesHistoryPage
  /accounts     → AccountsPage
  /accounts/:id → AccountDetailPage
  /payments     → PaymentsPage
  /reports      → ReportsPage
  /import-export→ ImportExportPage
  /settings     → SettingsPage
  ```
- [x] Create `src/app/layout/AppShell.tsx`:
  - Flexbox row: `<Sidebar />` + `<main>` (scrollable, max-w-1400px)
  - TopBar inside main content area
- [x] Create `src/app/layout/Sidebar.tsx`:
  - Dark background (`var(--sidebar)`)
  - QA logo/brand at top
  - Nav items with Lucide icons (9 items)
  - Active state via `NavLink` from React Router
  - Section dividers (MAIN / SYSTEM)
- [x] Create `src/app/layout/TopBar.tsx`:
  - Shows current date (formatted: "Saturday, April 4, 2026")
  - Settings gear icon links to `/settings`
- [x] Create placeholder page components for all 11 screens
- [x] Verify clicking all sidebar links navigates to correct pages

---

## 7. SQLite Database Initialization (Rust)

- [x] Create `src-tauri/src/db/connection.rs`:
  - Open/create SQLite file at `<data_dir>/QualityAppliance/quality_appliance.db`
  - Wrap in `DbState(Mutex<Connection>)` stored in Tauri's managed state
  - Enable WAL mode: `PRAGMA journal_mode=WAL`
  - Enable foreign keys: `PRAGMA foreign_keys=ON`
  - Uses `dirs` crate for cross-platform data directory
- [x] Create `src-tauri/src/db/migrations.rs`:
  - V1 migration: all 10 tables + indexes from `02-database-schema.md`
  - Track applied versions in `schema_migrations` table
  - Seed default `settings` rows on first launch (10 keys)
- [x] Wire up in `src-tauri/src/lib.rs`:
  ```rust
  pub fn run() {
      let conn = connection::init();
      tauri::Builder::default()
          .manage(DbState(Mutex::new(conn)))
          .invoke_handler(tauri::generate_handler![commands::db::ping])
          .run(tauri::generate_context!())
          .expect("error running app");
  }
  ```
- [x] Add `ping` Tauri command — returns `"pong — SQLite <version>"`

---

## 8. Invoke Wrapper & Error Handling Pattern

- [x] Create `src/lib/invoke.ts`:
  - Typed wrapper around `@tauri-apps/api/core` `invoke()`
  - All calls return `Promise<T>` or throw with console error logging
- [x] Create `src/lib/formatters.ts`:
  - `formatCurrency(amount)` → `₱1,234.56` (en-PH locale, PHP currency)
  - `formatDate(iso)` → `Apr 4, 2026`
  - `formatDateTime(iso)` → `Apr 4, 2026 2:30 PM`
  - `formatPercent(value)` → `5.00%`

---

## 9. Zustand Store Scaffolding

- [x] Create `src/stores/uiStore.ts`:
  - `sidebarCollapsed: boolean`
  - `toggleSidebar(): void`
- [x] Create all Zustand stores (scaffold with state + setters, no business logic):
  - `productStore.ts` — products, categories, variants arrays + loading
  - `customerStore.ts` — customers array + loading
  - `saleStore.ts` — sales, currentItems arrays + loading
  - `accountStore.ts` — accounts array + loading
  - `settingsStore.ts` — AppSettings with default values + loading

---

## 10. Window Configuration

- [x] In `tauri.conf.json`, configure window:
  ```json
  "width": 1400,
  "height": 900,
  "minWidth": 1024,
  "minHeight": 700,
  "resizable": true,
  "title": "Quality Appliance"
  ```
- [ ] Set app icon (placeholder — will be updated with real logo later)

---

## Phase 1 Sign-off Checklist

- [x] `npm run tauri build --no-bundle` succeeds without errors
- [x] SQLite file created at correct path on first launch
- [x] All nav links work, all placeholder pages render
- [x] `ping` command registered — returns `"pong — SQLite <version>"`
- [x] No TypeScript errors (`npx tsc --noEmit` passes)
- [x] Tailwind styles apply correctly — colors match design system
- [x] Inter font renders properly
- [x] Vite production build succeeds (2213 modules, 324KB JS gzipped to 101KB)
