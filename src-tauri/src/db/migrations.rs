use rusqlite::{Connection, Result};

/// Run all pending migrations.
pub fn run(conn: &Connection) -> Result<()> {
    // Create the schema_migrations table if it doesn't exist
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version     INTEGER PRIMARY KEY,
            applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );"
    )?;

    let version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if version < 1 {
        migrate_v1(conn)?;
    }

    if version < 2 {
        migrate_v2(conn)?;
    }

    if version < 3 {
        migrate_v3(conn)?;
    }

    Ok(())
}

/// V1 — Initial schema: all tables from docs/02-database-schema.md
fn migrate_v1(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        -- Categories
        CREATE TABLE IF NOT EXISTS categories (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Products
        CREATE TABLE IF NOT EXISTS products (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
            name          TEXT NOT NULL,
            description   TEXT,
            is_active     INTEGER NOT NULL DEFAULT 1,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
        CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

        -- Product Variants
        CREATE TABLE IF NOT EXISTS product_variants (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
            sku                 TEXT UNIQUE,
            attributes          TEXT,
            cost_price          REAL NOT NULL DEFAULT 0,
            selling_price       REAL NOT NULL DEFAULT 0,
            stock_qty           INTEGER NOT NULL DEFAULT 0,
            low_stock_threshold INTEGER NOT NULL DEFAULT 2,
            is_active           INTEGER NOT NULL DEFAULT 1,
            created_at          TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
        CREATE INDEX IF NOT EXISTS idx_variants_active ON product_variants(is_active);

        -- Customers
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

        -- Sales
        CREATE TABLE IF NOT EXISTS sales (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
            sale_date       TEXT NOT NULL DEFAULT (datetime('now')),
            subtotal        REAL NOT NULL,
            discount        REAL NOT NULL DEFAULT 0,
            total           REAL NOT NULL,
            payment_type    TEXT NOT NULL CHECK(payment_type IN ('cash', 'installment')),
            status          TEXT NOT NULL DEFAULT 'completed'
                            CHECK(status IN ('completed', 'voided')),
            notes           TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
        CREATE INDEX IF NOT EXISTS idx_sales_type ON sales(payment_type);

        -- Sale Items
        CREATE TABLE IF NOT EXISTS sale_items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
            variant_id  INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
            quantity    INTEGER NOT NULL DEFAULT 1,
            unit_price  REAL NOT NULL,
            subtotal    REAL NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id);

        -- Installment Accounts
        CREATE TABLE IF NOT EXISTS installment_accounts (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id             INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
            customer_id         INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
            principal           REAL NOT NULL,
            down_payment        REAL NOT NULL DEFAULT 0,
            interest_rate       REAL NOT NULL DEFAULT 0,
            penalty_rate        REAL NOT NULL DEFAULT 0,
            balance_remaining   REAL NOT NULL,
            has_schedule        INTEGER NOT NULL DEFAULT 1,
            term_months         INTEGER,
            monthly_amount      REAL,
            start_date          TEXT,
            status              TEXT NOT NULL DEFAULT 'open'
                                CHECK(status IN ('open', 'paid', 'defaulted')),
            last_penalty_date   TEXT,
            notes               TEXT,
            created_at          TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_accounts_customer ON installment_accounts(customer_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_status ON installment_accounts(status);
        CREATE INDEX IF NOT EXISTS idx_accounts_sale ON installment_accounts(sale_id);

        -- Payment Schedules
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

        -- Payments
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

        -- Settings
        CREATE TABLE IF NOT EXISTS settings (
            key         TEXT PRIMARY KEY,
            value       TEXT NOT NULL,
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Seed default settings
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('default_interest_rate', '5'),
            ('default_penalty_rate', '2'),
            ('default_term_months', '12'),
            ('default_down_payment_pct', '20'),
            ('low_stock_threshold', '2'),
            ('store_name', 'Quality Appliance'),
            ('store_address', ''),
            ('store_phone', ''),
            ('currency_symbol', '₱'),
            ('preset_terms', '3,6,12,18,24');

        -- Record migration
        INSERT INTO schema_migrations (version) VALUES (1);
        "
    )?;

    println!("[db] Applied migration v1 — initial schema");
    Ok(())
}

/// V2 — Import logs table for Phase 6 (Import / Export)
fn migrate_v2(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS import_logs (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            import_type    TEXT NOT NULL,
            filename       TEXT NOT NULL,
            rows_added     INTEGER NOT NULL DEFAULT 0,
            rows_skipped   INTEGER NOT NULL DEFAULT 0,
            rows_errored   INTEGER NOT NULL DEFAULT 0,
            error_details  TEXT,
            imported_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO schema_migrations (version) VALUES (2);
        "
    )?;

    println!("[db] Applied migration v2 — import_logs table");
    Ok(())
}

/// V3 — Snapshot cost_price on sale_items to preserve historical P&L accuracy
fn migrate_v3(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        ALTER TABLE sale_items ADD COLUMN cost_price_snapshot REAL NOT NULL DEFAULT 0;

        INSERT INTO schema_migrations (version) VALUES (3);
        "
    )?;

    println!("[db] Applied migration v3 — cost_price_snapshot on sale_items");
    Ok(())
}
