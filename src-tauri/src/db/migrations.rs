use rusqlite::{Connection, Result};

/// The highest migration version number. Increment this whenever a new migration is added.
pub const LATEST_VERSION: i32 = 16;

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

    if version < 4 {
        migrate_v4(conn)?;
    }

    if version < 5 {
        migrate_v5(conn)?;
    }

    if version < 6 {
        migrate_v6(conn)?;
    }

    if version < 7 {
        migrate_v7(conn)?;
    }

    if version < 8 {
        migrate_v8(conn)?;
    }

    if version < 9 {
        migrate_v9(conn)?;
    }

    if version < 10 {
        migrate_v10(conn)?;
    }

    if version < 11 {
        migrate_v11(conn)?;
    }

    if version < 12 {
        migrate_v12(conn)?;
    }

    if version < 13 {
        migrate_v13(conn)?;
    }

    if version < 14 {
        migrate_v14(conn)?;
    }

    if version < 15 {
        migrate_v15(conn)?;
    }

    if version < 16 {
        migrate_v16(conn)?;
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
            subtotal        REAL NOT NULL DEFAULT 0,
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
        CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);

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
/// V4 — (Demo seed data stripped — use seed_demo_data command instead)
fn migrate_v4(conn: &Connection) -> Result<()> {
    conn.execute_batch("INSERT INTO schema_migrations (version) VALUES (4);")?;
    println!("[db] Applied migration v4 — (demo data stripped)");
    Ok(())
}

/// V5 — Additional indexes for frequently-filtered columns
fn migrate_v5(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
        CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
        CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
        CREATE INDEX IF NOT EXISTS idx_payments_account_date ON payments(account_id, payment_date);
        CREATE INDEX IF NOT EXISTS idx_schedules_account_status ON payment_schedules(account_id, status);
        INSERT INTO schema_migrations (version) VALUES (5);
        "
    )?;
    println!("[db] Applied migration v5 — additional performance indexes");
    Ok(())
}

/// V6 — Audit log table for financial operations
fn migrate_v6(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS audit_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            action      TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id   INTEGER,
            details     TEXT,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
        INSERT INTO schema_migrations (version) VALUES (6);
        "
    )?;
    println!("[db] Applied migration v6 — audit log table");
    Ok(())
}

/// V7 — Discount types, per-item discounts, and early-payment rebate
fn migrate_v7(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        -- Sales: store the original discount input (type + raw value)
        ALTER TABLE sales ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'peso';
        ALTER TABLE sales ADD COLUMN discount_value REAL NOT NULL DEFAULT 0;

        -- Backfill existing sales
        UPDATE sales SET discount_value = discount, discount_type = 'peso' WHERE discount > 0;

        -- Sale items: per-item discount support
        ALTER TABLE sale_items ADD COLUMN item_discount REAL NOT NULL DEFAULT 0;
        ALTER TABLE sale_items ADD COLUMN item_discount_type TEXT NOT NULL DEFAULT 'peso';
        ALTER TABLE sale_items ADD COLUMN item_discount_value REAL NOT NULL DEFAULT 0;

        -- Installment accounts: per-account rebate rate
        ALTER TABLE installment_accounts ADD COLUMN rebate_rate REAL NOT NULL DEFAULT 0;

        -- New settings for rebate feature
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('rebate_enabled', '0'),
            ('default_rebate_rate', '5');

        INSERT INTO schema_migrations (version) VALUES (7);
        "
    )?;
    println!("[db] Applied migration v7 — discount types, per-item discounts, rebate");
    Ok(())
}

fn migrate_v8(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        -- Customers: optional credit limit
        ALTER TABLE customers ADD COLUMN credit_limit REAL DEFAULT NULL;

        -- Stock movement history
        CREATE TABLE IF NOT EXISTS stock_movements (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            variant_id      INTEGER NOT NULL REFERENCES product_variants(id),
            delta           INTEGER NOT NULL,
            reason          TEXT NOT NULL,
            reference_type  TEXT,
            reference_id    INTEGER,
            notes           TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON stock_movements(variant_id);
        CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);

        -- Payment reversal support
        ALTER TABLE payments ADD COLUMN is_reversed INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE payments ADD COLUMN reversed_at TEXT;
        ALTER TABLE payments ADD COLUMN reversed_reason TEXT;

        -- Grace period and penalty cap settings
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('grace_period_days', '0'),
            ('max_penalties_per_account', '0');

        INSERT INTO schema_migrations (version) VALUES (8);
        "
    )?;

    // Backfill stock_movements from existing sale_items (initial history)
    conn.execute_batch(
        "
        INSERT INTO stock_movements (variant_id, delta, reason, reference_type, reference_id, created_at)
        SELECT si.variant_id, -si.quantity, 'sale', 'sale', si.sale_id, s.created_at
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        WHERE s.status = 'completed';
        "
    )?;

    println!("[db] Applied migration v8 — credit limit, stock movements, payment reversal, grace period");
    Ok(())
}

/// V9 — Performance indexes + low_stock_threshold setting
fn migrate_v9(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        -- Performance indexes for frequently queried relationships
        CREATE INDEX IF NOT EXISTS idx_installment_accounts_customer_status
            ON installment_accounts (customer_id, status);
        CREATE INDEX IF NOT EXISTS idx_installment_accounts_sale_id
            ON installment_accounts (sale_id);
        CREATE INDEX IF NOT EXISTS idx_payments_account_id_type
            ON payments (account_id, type);
        CREATE INDEX IF NOT EXISTS idx_payments_payment_date
            ON payments (payment_date);
        CREATE INDEX IF NOT EXISTS idx_payment_schedules_account_status
            ON payment_schedules (account_id, status);
        CREATE INDEX IF NOT EXISTS idx_payment_schedules_due_date
            ON payment_schedules (due_date);
        CREATE INDEX IF NOT EXISTS idx_sales_customer_id
            ON sales (customer_id);
        CREATE INDEX IF NOT EXISTS idx_sales_status
            ON sales (status);
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id
            ON sale_items (sale_id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_variant_id
            ON sale_items (variant_id);
        CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
            ON product_variants (product_id);
        CREATE INDEX IF NOT EXISTS idx_product_variants_sku
            ON product_variants (sku) WHERE sku IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_id
            ON stock_movements (variant_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_entity
            ON audit_log (entity_type, entity_id);

        -- Low stock threshold setting (global default, currently hardcoded)
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('low_stock_threshold', '5');

        INSERT INTO schema_migrations (version) VALUES (9);
        "
    )?;

    println!("[db] Applied migration v9 — performance indexes, low stock threshold setting");
    Ok(())
}

/// V10 — Fix CHECK constraints: add 'rebate'/'waived_penalty' to payments.type,
///        'voided' to payment_schedules.status, 'voided' to installment_accounts.status.
///        SQLite doesn't support ALTER CHECK, so we recreate the affected tables.
fn migrate_v10(conn: &Connection) -> Result<()> {
    // Must disable FK enforcement before dropping/recreating tables that reference each other.
    // PRAGMA foreign_keys cannot be changed inside a transaction, so we do it here explicitly.
    conn.execute_batch("PRAGMA foreign_keys = OFF;")?;

    let result = conn.execute_batch(
        "
        -- 1) Recreate installment_accounts with 'voided' status
        DROP TABLE IF EXISTS installment_accounts_new;
        CREATE TABLE installment_accounts_new (
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
                                CHECK(status IN ('open', 'paid', 'defaulted', 'voided')),
            last_penalty_date   TEXT,
            notes               TEXT,
            created_at          TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
            rebate_rate         REAL NOT NULL DEFAULT 0
        );

        INSERT INTO installment_accounts_new
            SELECT id, sale_id, customer_id, principal, down_payment, interest_rate,
                   penalty_rate, balance_remaining, has_schedule, term_months, monthly_amount,
                   start_date, status, last_penalty_date, notes, created_at, updated_at, rebate_rate
            FROM installment_accounts;

        DROP TABLE installment_accounts;
        ALTER TABLE installment_accounts_new RENAME TO installment_accounts;

        CREATE INDEX IF NOT EXISTS idx_accounts_customer ON installment_accounts(customer_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_status ON installment_accounts(status);
        CREATE INDEX IF NOT EXISTS idx_accounts_sale ON installment_accounts(sale_id);
        CREATE INDEX IF NOT EXISTS idx_installment_accounts_customer_status
            ON installment_accounts (customer_id, status);
        CREATE INDEX IF NOT EXISTS idx_installment_accounts_sale_id
            ON installment_accounts (sale_id);

        -- 2) Recreate payment_schedules with 'voided' status
        DROP TABLE IF EXISTS payment_schedules_new;
        CREATE TABLE payment_schedules_new (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id      INTEGER NOT NULL REFERENCES installment_accounts(id) ON DELETE CASCADE,
            due_date        TEXT NOT NULL,
            amount_due      REAL NOT NULL,
            amount_paid     REAL NOT NULL DEFAULT 0,
            status          TEXT NOT NULL DEFAULT 'pending'
                            CHECK(status IN ('pending', 'paid', 'overdue', 'partial', 'voided')),
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO payment_schedules_new
            SELECT id, account_id, due_date, amount_due, amount_paid, status, created_at, updated_at
            FROM payment_schedules;

        DROP TABLE payment_schedules;
        ALTER TABLE payment_schedules_new RENAME TO payment_schedules;

        CREATE INDEX IF NOT EXISTS idx_schedules_account ON payment_schedules(account_id);
        CREATE INDEX IF NOT EXISTS idx_schedules_due_date ON payment_schedules(due_date);
        CREATE INDEX IF NOT EXISTS idx_schedules_status ON payment_schedules(status);
        CREATE INDEX IF NOT EXISTS idx_payment_schedules_account_status
            ON payment_schedules (account_id, status);
        CREATE INDEX IF NOT EXISTS idx_payment_schedules_due_date
            ON payment_schedules (due_date);

        -- 3) Recreate payments with 'rebate'/'waived_penalty' types
        DROP TABLE IF EXISTS payments_new;
        CREATE TABLE payments_new (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id    INTEGER NOT NULL REFERENCES installment_accounts(id) ON DELETE RESTRICT,
            schedule_id   INTEGER REFERENCES payment_schedules(id) ON DELETE SET NULL,
            amount        REAL NOT NULL,
            payment_date  TEXT NOT NULL DEFAULT (datetime('now')),
            type          TEXT NOT NULL DEFAULT 'payment'
                          CHECK(type IN ('payment', 'penalty', 'interest_adjustment', 'down_payment', 'rebate', 'waived_penalty')),
            notes         TEXT,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            is_reversed   INTEGER NOT NULL DEFAULT 0,
            reversed_at   TEXT,
            reversed_reason TEXT
        );

        INSERT INTO payments_new
            SELECT id, account_id, schedule_id, amount, payment_date, type, notes, created_at,
                   is_reversed, reversed_at, reversed_reason
            FROM payments;

        DROP TABLE payments;
        ALTER TABLE payments_new RENAME TO payments;

        CREATE INDEX IF NOT EXISTS idx_payments_account ON payments(account_id);
        CREATE INDEX IF NOT EXISTS idx_payments_schedule ON payments(schedule_id);
        CREATE INDEX IF NOT EXISTS idx_payments_account_id_type
            ON payments (account_id, type);
        CREATE INDEX IF NOT EXISTS idx_payments_date
            ON payments (payment_date);

        INSERT INTO schema_migrations (version) VALUES (10);
        "
    );

    // Always re-enable FK enforcement regardless of whether migration succeeded
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    result?;

    println!("[db] Applied migration v10 — fix CHECK constraints for rebate, voided statuses");
    Ok(())
}

/// V11 — Add imported_ids column to import_logs, brand/model to products
fn migrate_v11(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        ALTER TABLE import_logs ADD COLUMN imported_ids TEXT;
        ALTER TABLE products ADD COLUMN brand TEXT;
        ALTER TABLE products ADD COLUMN model TEXT;

        INSERT INTO schema_migrations (version) VALUES (11);
        "
    )?;

    println!("[db] Applied migration v11 — import_logs.imported_ids, products.brand/model");
    Ok(())
}

/// V12 — Add interest_type column so each account explicitly records how interest is calculated.
fn migrate_v12(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        ALTER TABLE installment_accounts ADD COLUMN interest_type TEXT NOT NULL DEFAULT 'monthly';
        INSERT INTO schema_migrations (version) VALUES (12);
        "
    )?;

    println!("[db] Applied migration v12 — installment_accounts.interest_type");
    Ok(())
}

/// V13 — Change rebates from percentage-based to fixed peso amount.
fn migrate_v13(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        ALTER TABLE installment_accounts ADD COLUMN rebate_amount REAL NOT NULL DEFAULT 0;
        UPDATE settings SET value = '0' WHERE key = 'default_rebate_rate';
        UPDATE settings SET key = 'default_rebate_amount' WHERE key = 'default_rebate_rate';
        INSERT INTO schema_migrations (version) VALUES (13);
        "
    )?;

    println!("[db] Applied migration v13 — rebate_amount (fixed peso)");
    Ok(())
}

/// V14 — Serial numbers for product variants.
fn migrate_v14(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE serial_numbers (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            variant_id   INTEGER NOT NULL REFERENCES product_variants(id),
            serial_no    TEXT NOT NULL,
            status       TEXT NOT NULL DEFAULT 'in_stock'
                             CHECK(status IN ('in_stock', 'sold')),
            sale_item_id INTEGER REFERENCES sale_items(id),
            added_at     TEXT NOT NULL DEFAULT (datetime('now')),
            sold_at      TEXT,
            notes        TEXT
        );
        CREATE UNIQUE INDEX idx_serial_variant_serial
            ON serial_numbers(variant_id, serial_no);
        CREATE INDEX idx_serial_status
            ON serial_numbers(status);
        INSERT INTO schema_migrations (version) VALUES (14);
        "
    )?;

    println!("[db] Applied migration v14 — serial_numbers table");
    Ok(())
}

/// V15 — Add installment_price column to product_variants.
fn migrate_v15(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        ALTER TABLE product_variants ADD COLUMN installment_price REAL;
        INSERT INTO schema_migrations (version) VALUES (15);
        "
    )?;

    println!("[db] Applied migration v15 — installment_price column");
    Ok(())
}

/// V16 — (Demo installment prices + serial numbers stripped — use seed_demo_data)
fn migrate_v16(conn: &Connection) -> Result<()> {
    conn.execute_batch("INSERT INTO schema_migrations (version) VALUES (16);")?;
    println!("[db] Applied migration v16 — (demo data stripped)");
    Ok(())
}
