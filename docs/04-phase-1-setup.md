# Phase 1 — Project Setup & Scaffolding

## Goal
Bootstrap the full Tauri v2 + React + TypeScript project. By the end of this phase, the app launches with a working sidebar, routing, and an initialized SQLite database — no business logic yet.

## Prerequisites
- [ ] Rust toolchain installed (`rustup`, stable channel)
- [ ] Node.js 20+ installed
- [ ] `cargo install tauri-cli` (v2)
- [ ] Confirm target: Windows (primary), build from macOS dev environment

---

## 1. Project Scaffolding

- [ ] Run `npm create tauri-app@latest quality-appliance` with options:
  - Frontend: `React`
  - Language: `TypeScript`
  - Package manager: `npm`
- [ ] Verify project runs: `npm run tauri dev`
- [ ] Rename `src-tauri/tauri.conf.json` app identifier to `com.qualityappliance.app`
- [ ] Set `productName` to `"Quality Appliance"` in `tauri.conf.json`
- [ ] Set `version` to `"1.0.0"` in `tauri.conf.json`

---

## 2. Frontend Dependencies

- [ ] Install UI and utility packages:
  ```bash
  npm install @radix-ui/react-* lucide-react
  npm install tailwindcss @tailwindcss/vite
  npm install react-router-dom
  npm install zustand
  npm install react-hook-form @hookform/resolvers zod
  npm install recharts
  npm install xlsx jspdf jspdf-autotable
  npm install date-fns
  npm install clsx tailwind-merge
  ```
- [ ] Install shadcn/ui CLI and initialize:
  ```bash
  npx shadcn@latest init
  ```
  - Style: `default`
  - Base color: `slate`
  - CSS variables: `yes`
- [ ] Add initial shadcn components:
  ```bash
  npx shadcn@latest add button input label select dialog table badge card separator tooltip
  ```

---

## 3. Rust Dependencies (`src-tauri/Cargo.toml`)

- [ ] Add `rusqlite` with bundled flag (bundles SQLite natively):
  ```toml
  [dependencies]
  rusqlite = { version = "0.31", features = ["bundled"] }
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"
  tauri = { version = "2", features = [] }
  ```
- [ ] Run `cargo check` inside `src-tauri/` to confirm dependencies resolve

---

## 4. Tailwind & Global Styles

- [ ] Configure `vite.config.ts` to use `@tailwindcss/vite` plugin
- [ ] Create `src/styles/globals.css` with:
  - Tailwind `@import "tailwindcss"`
  - CSS custom properties from `03-ui-design.md` (colors, font sizes)
  - Base styles: `font-family: 'Inter', sans-serif`
  - Scrollbar styling (subtle, thin)
- [ ] Add Google Fonts Inter import in `index.html` (or bundle via `fontsource`)
  ```bash
  npm install @fontsource/inter
  ```
- [ ] Import Inter in `src/main.tsx`:
  ```ts
  import '@fontsource/inter/400.css'
  import '@fontsource/inter/500.css'
  import '@fontsource/inter/600.css'
  import '@fontsource/inter/700.css'
  ```

---

## 5. TypeScript Configuration

- [ ] Configure `tsconfig.json`:
  - `strict: true`
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - Path aliases: `@/*` → `./src/*`
- [ ] Configure `vite.config.ts` with matching path aliases
- [ ] Create `src/types/` directory and add initial empty type files:
  - `product.ts`
  - `customer.ts`
  - `sale.ts`
  - `account.ts`
  - `payment.ts`
  - `report.ts`
  - `settings.ts`

---

## 6. App Layout & Routing

- [ ] Create `src/app/router.tsx` with React Router v6 routes:
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
- [ ] Create `src/app/layout/AppShell.tsx`:
  - Flexbox row: `<Sidebar />` + `<main>` (scrollable)
  - TopBar inside main content area
- [ ] Create `src/app/layout/Sidebar.tsx`:
  - Dark background (`--color-sidebar-bg`)
  - Logo/brand at top
  - Nav items with Lucide icons
  - Active state via `NavLink` from React Router
  - Section dividers (MAIN / SYSTEM)
- [ ] Create `src/app/layout/TopBar.tsx`:
  - Shows current date (formatted: "Saturday, April 4, 2026")
  - Settings gear icon links to `/settings`
- [ ] Create placeholder page components for all 9 screens (just a heading each)
- [ ] Verify clicking all sidebar links navigates to correct pages

---

## 7. SQLite Database Initialization (Rust)

- [ ] Create `src-tauri/src/db/connection.rs`:
  - Open/create SQLite file at `$APPDATA/quality-appliance/app.db`
  - Wrap in a `Mutex<Connection>` stored in Tauri's managed state
  - Enable WAL mode: `PRAGMA journal_mode=WAL`
  - Enable foreign keys: `PRAGMA foreign_keys=ON`
- [ ] Create `src-tauri/src/db/migrations.rs`:
  - Run all `CREATE TABLE IF NOT EXISTS` statements from `02-database-schema.md`
  - Track applied versions in `schema_migrations` table
  - Seed default `settings` rows on first launch
- [ ] Wire up in `src-tauri/src/main.rs`:
  ```rust
  fn main() {
      tauri::Builder::default()
          .setup(|app| {
              let conn = db::connection::init(app.handle())?;
              db::migrations::run(&conn)?;
              app.manage(Mutex::new(conn));
              Ok(())
          })
          .invoke_handler(tauri::generate_handler![
              // commands registered here later
          ])
          .run(tauri::generate_context!())
          .expect("error running app");
  }
  ```
- [ ] Add a test Tauri command `ping` that returns `"pong"` — verify IPC works from frontend

---

## 8. Invoke Wrapper & Error Handling Pattern

- [ ] Create `src/lib/invoke.ts`:
  - Typed wrapper around `@tauri-apps/api/core` `invoke()`
  - All calls return `Promise<T>` or throw a typed error
  - Example:
    ```typescript
    import { invoke as tauriInvoke } from '@tauri-apps/api/core'

    export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
      return tauriInvoke<T>(cmd, args)
    }
    ```
- [ ] Create `src/lib/formatters.ts`:
  - `formatCurrency(amount: number): string` → `₱ 1,234.56`
  - `formatDate(dateStr: string): string` → `Apr 4, 2026`
  - `formatDateTime(dateStr: string): string` → `Apr 4, 2026 2:30 PM`
  - `formatPercent(rate: number): string` → `5.00%`

---

## 9. Zustand Store Scaffolding

- [ ] Create `src/stores/uiStore.ts`:
  - `activePage: string`
  - `openModal: string | null`
  - `setOpenModal(modal: string | null): void`
- [ ] Create remaining empty store files (product, customer, sale, account, settings) — scaffold only, no logic yet

---

## 10. Window Configuration

- [ ] In `tauri.conf.json`, configure window:
  ```json
  "width": 1400,
  "height": 900,
  "minWidth": 1024,
  "minHeight": 700,
  "resizable": true,
  "title": "Quality Appliance"
  ```
- [ ] Set app icon (placeholder for now — can be updated with real logo later)

---

## Phase 1 Sign-off Checklist

- [ ] `npm run tauri dev` launches without errors
- [ ] SQLite file created at correct path on first launch
- [ ] All nav links work, all placeholder pages render
- [ ] `ping` command returns `"pong"` from Rust
- [ ] No TypeScript errors (`npx tsc --noEmit` passes)
- [ ] Tailwind styles apply correctly — colors match design system
- [ ] Inter font renders properly
