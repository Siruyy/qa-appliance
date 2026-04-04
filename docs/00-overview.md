# Quality Appliance — Project Overview

## Project Summary

A local desktop management system for **Quality Appliance**, a physical appliance store. The system handles inventory, sales (cash & installment/utang), accounts receivable, payments, customer records, and reporting. It is packaged as a standalone installable desktop application — no internet connection required, no cloud backend.

---

## Goals

- Replace manual/spreadsheet tracking with a structured, reliable system
- Track all sales and outstanding balances (installment + utang) in one place
- Give the owner at-a-glance visibility into the store's financial health
- Minimize training overhead — UI must be intuitive for non-technical staff
- All data stays on the owner's laptop (data sovereignty, no subscription fees)
- Easy data backup via export; easy migration via import

---

## Non-Goals (Explicitly Out of Scope)

- No online/cloud sync
- No multi-branch support
- No receipt printer integration
- No barcode scanner support (for now)
- No payroll or employee management
- No supplier order management (only manual stock updates)

---

## Application Screens

| # | Screen | Purpose |
|---|--------|---------|
| 1 | **Dashboard** | KPIs, overdue alerts, sales trends, quick actions |
| 2 | **Inventory** | Products + variants — stock, pricing, categories |
| 3 | **Customers** | Customer profiles, contact info, linked accounts |
| 4 | **New Sale** | Main transaction flow — select products, choose payment type |
| 5 | **Accounts / Receivables** | All open installment and utang accounts |
| 6 | **Payments** | Record incoming payments against accounts |
| 7 | **Reports** | 6 report types, all exportable |
| 8 | **Import / Export** | Bulk data in and out |
| 9 | **Settings** | Interest rates, penalty rates, default installment terms, app config |

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop Shell | **Tauri v2** | ~5–15MB installer (vs ~200MB Electron). Uses system WebView + Rust. No Chromium bundled. |
| Frontend | **React 18 + TypeScript** | Component ecosystem, strict typing for financial logic, easy to maintain |
| UI Components | **shadcn/ui + Tailwind CSS v4** | Pre-built accessible business components. Consistent design system. |
| Charts | **Recharts** | Lightweight, composable, works well with React |
| State Management | **Zustand** | Minimal boilerplate, predictable, SSR-safe |
| Form Validation | **React Hook Form + Zod** | Performant forms, type-safe schema validation |
| Database | **SQLite** (via `rusqlite` in Rust) | Single `.db` file = the backup. No server to configure. Perfect for single-user. |
| Rust Commands | **Tauri IPC commands** | Rust handles all DB reads/writes and file I/O. Frontend calls via `invoke()`. |
| Export | **`xlsx`** (Excel), **`jsPDF`** (PDF), native CSV | All export formats covered |
| Import | **`xlsx`** parser + Rust file dialog | Template-based import for products, customers, stock updates |

---

## Payment Types

| Type | Description |
|------|-------------|
| **Cash** | Full payment at time of sale. Account closes immediately. |
| **Installment** | Structured — down payment + monthly payments over N months. Payment schedule auto-generated. Interest applied. |
| **Utang (Open Credit)** | Unstructured — no fixed payment schedule. Balance tracked, interest accrues monthly. Customer pays whenever. |

> Both Installment and Utang share the same `installment_accounts` model — only difference is whether `has_schedule = true`.

---

## Document Index

| File | Contents |
|------|---------|
| [01-architecture.md](./01-architecture.md) | Technical architecture, IPC pattern, folder structure |
| [02-database-schema.md](./02-database-schema.md) | Full SQLite schema — all tables, columns, indexes |
| [03-ui-design.md](./03-ui-design.md) | Design system — colors, typography, components, layout |
| [04-phase-1-setup.md](./04-phase-1-setup.md) | Phase 1: Project scaffolding & dev environment |
| [05-phase-2-inventory.md](./05-phase-2-inventory.md) | Phase 2: Inventory module (products + variants) |
| [06-phase-3-customers-sales.md](./06-phase-3-customers-sales.md) | Phase 3: Customers + New Sale flow |
| [07-phase-4-accounts-payments.md](./07-phase-4-accounts-payments.md) | Phase 4: Accounts/Receivables + Payments |
| [08-phase-5-reports.md](./08-phase-5-reports.md) | Phase 5: Reports & Analytics |
| [09-phase-6-import-export.md](./09-phase-6-import-export.md) | Phase 6: Import / Export |
| [10-phase-7-dashboard-settings-polish.md](./10-phase-7-dashboard-settings-polish.md) | Phase 7: Dashboard, Settings, final polish |

---

## Development Phases Summary

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| **Phase 1** | Setup | Tauri scaffold, DB init, routing, layout shell |
| **Phase 2** | Inventory | Products, variants, categories CRUD |
| **Phase 3** | Customers + Sales | Customer CRUD, New Sale flow, cash sales |
| **Phase 4** | Accounts + Payments | Installment/utang creation, payment recording, overdue detection |
| **Phase 5** | Reports | All 6 report types + export |
| **Phase 6** | Import/Export | Template import, bulk export |
| **Phase 7** | Dashboard + Polish | Dashboard KPIs, settings, UX polish, final QA |
