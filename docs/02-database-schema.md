# Quality Appliance — Database Schema

## Overview

Single SQLite file. All tables created on first launch via `migrations.rs`. Schema versioned via a `schema_version` table to support future migrations.

---

## Schema Version Table

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 1. Categories

```sql
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Notes:**
- Examples: "Refrigerator", "Washing Machine", "Air Conditioner", "TV"
- `name` is unique — no duplicate category names

---

## 2. Products

```sql
CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  description   TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,  -- 0 = archived, 1 = active
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
```

**Notes:**
- `is_active = 0` archives a product without deleting it (protects sale history)
- A product is the parent — e.g., "Samsung Refrigerator RT50K"

---

## 3. Product Variants

```sql
CREATE TABLE IF NOT EXISTS product_variants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  sku           TEXT UNIQUE,                  -- Optional stock-keeping unit code
  attributes    TEXT,                         -- JSON: {"color": "White", "size": "350L"}
  cost_price    REAL NOT NULL DEFAULT 0,      -- What the store paid (for P&L)
  selling_price REAL NOT NULL DEFAULT 0,      -- What the customer pays
  stock_qty     INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 2, -- Alert when qty <= this
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_active ON product_variants(is_active);
```

**Notes:**
- `attributes` stored as JSON string — flexible for any variant type
- `stock_qty` is decremented when a sale is confirmed
- Each variant has its own `cost_price` and `selling_price`

---

## 4. Customers

```sql
CREATE TABLE IF NOT EXISTS customers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
```

**Notes:**
- `phone` is searchable — staff usually look up by phone number
- `notes` for any additional context (e.g., "co-maker: Juan dela Cruz")

---

## 5. Sales

```sql
CREATE TABLE IF NOT EXISTS sales (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  sale_date       TEXT NOT NULL DEFAULT (datetime('now')),
  subtotal        REAL NOT NULL,              -- Sum of line items (before discount)
  discount        REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL,              -- subtotal - discount
  payment_type    TEXT NOT NULL CHECK(payment_type IN ('cash', 'installment')),
  status          TEXT NOT NULL DEFAULT 'completed'
                  CHECK(status IN ('completed', 'voided')),
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_type ON sales(payment_type);
```

**Notes:**
- Cash sales: `payment_type = 'cash'`, closed immediately
- Installment/utang: `payment_type = 'installment'`, triggers creation of `installment_accounts` row
- `customer_id` nullable — walk-in customers without a profile (cash only)
- `voided` status soft-deletes a sale without removing history

---

## 6. Sale Items

```sql
CREATE TABLE IF NOT EXISTS sale_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id  INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL DEFAULT 1,
  unit_price  REAL NOT NULL,     -- Snapshot of selling_price at time of sale
  subtotal    REAL NOT NULL,     -- quantity × unit_price
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id);
```

**Notes:**
- `unit_price` is a **snapshot** — if a product's price changes later, historical sales remain accurate
- On sale creation, `product_variants.stock_qty` is decremented by `quantity`
- On sale void, stock is restored

---

## 7. Installment Accounts

```sql
CREATE TABLE IF NOT EXISTS installment_accounts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id             INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  customer_id         INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  principal           REAL NOT NULL,       -- Total sale amount (after discount, before interest)
  down_payment        REAL NOT NULL DEFAULT 0,
  interest_rate       REAL NOT NULL DEFAULT 0,  -- Monthly % rate
  penalty_rate        REAL NOT NULL DEFAULT 0,  -- % applied to balance when overdue
  balance_remaining   REAL NOT NULL,       -- Current outstanding balance (incl. interest)
  has_schedule        INTEGER NOT NULL DEFAULT 1, -- 1 = installment, 0 = open-ended utang
  term_months         INTEGER,             -- NULL if has_schedule = 0
  monthly_amount      REAL,               -- NULL if has_schedule = 0
  start_date          TEXT,               -- NULL if has_schedule = 0
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK(status IN ('open', 'paid', 'defaulted')),
  last_penalty_date   TEXT,               -- Date last penalty was applied
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_accounts_customer ON installment_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON installment_accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_sale ON installment_accounts(sale_id);
```

**Notes:**
- `balance_remaining` is the live balance — decremented by payments, increased by interest/penalties
- `has_schedule = 0` → open utang (no payment schedule rows)
- `has_schedule = 1` → installment (payment_schedules rows generated)

---

## 8. Payment Schedules

*Only exists for accounts where `has_schedule = 1`*

```sql
CREATE TABLE IF NOT EXISTS payment_schedules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id      INTEGER NOT NULL REFERENCES installment_accounts(id) ON DELETE CASCADE,
  due_date        TEXT NOT NULL,
  amount_due      REAL NOT NULL,
  amount_paid     REAL NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending', 'paid', 'overdue', 'partial')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_schedules_account ON payment_schedules(account_id);
CREATE INDEX IF NOT EXISTS idx_schedules_due_date ON payment_schedules(due_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON payment_schedules(status);
```

**Notes:**
- Generated automatically when an installment account is created
- `status` updated by the payment recording logic
- `partial` = some payment received but less than `amount_due`

---

## 9. Payments

```sql
CREATE TABLE IF NOT EXISTS payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id    INTEGER NOT NULL REFERENCES installment_accounts(id) ON DELETE RESTRICT,
  schedule_id   INTEGER REFERENCES payment_schedules(id) ON DELETE SET NULL,
  amount        REAL NOT NULL,
  payment_date  TEXT NOT NULL DEFAULT (datetime('now')),
  type          TEXT NOT NULL DEFAULT 'payment'
                CHECK(type IN ('payment', 'penalty', 'interest_adjustment', 'down_payment')),
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_account ON payments(account_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_schedule ON payments(schedule_id);
```

**Notes:**
- `schedule_id` nullable — for open-ended utang accounts with no schedule
- `type = 'penalty'` auto-created by the penalty detection service
- `type = 'down_payment'` recorded when the installment account is first created
- All payments reduce `installment_accounts.balance_remaining`

---

## 10. Settings

```sql
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Default seed values (inserted on first launch):**

| Key | Default Value | Description |
|-----|---------------|-------------|
| `default_interest_rate` | `"5"` | Monthly interest rate % |
| `default_penalty_rate` | `"2"` | Penalty % applied on overdue balance |
| `default_term_months` | `"12"` | Default installment term |
| `default_down_payment_pct` | `"20"` | Default down payment % of principal |
| `low_stock_threshold` | `"2"` | Global low stock warning level |
| `store_name` | `"Quality Appliance"` | Display name in reports/exports |
| `store_address` | `""` | Used in PDF report headers |
| `store_phone` | `""` | Used in PDF report headers |
| `currency_symbol` | `"₱"` | Currency display symbol |
| `preset_terms` | `"3,6,12,18,24"` | Comma-separated preset installment terms |

---

## Entity Relationship Summary

```
categories ──< products ──< product_variants
                                    │
                                    └──< sale_items >──── sales
                                                            │
customers ──────────────────────────────────────────────────┤
    │                                                        │
    └──< installment_accounts ──────────────────────────────┘
              │
              ├──< payment_schedules
              │
              └──< payments
```

---

## Data Integrity Rules

1. Products cannot be deleted if they have sale history — use `is_active = 0` instead
2. Customers cannot be deleted if they have accounts — use `is_active = 0` instead
3. Sales cannot be deleted — only voided (soft delete)
4. Voiding a sale restores stock quantities
5. Accounts cannot be deleted while they have payment history
6. Payment amounts must be > 0
7. `balance_remaining` is always recalculated from actual payment records on conflict (eventual consistency via a `recalculate_balance` command)
