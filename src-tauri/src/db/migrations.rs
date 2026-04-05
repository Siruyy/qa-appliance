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

    if version < 4 {
        migrate_v4(conn)?;
    }

    if version < 5 {
        migrate_v5(conn)?;
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

/// V4 — Comprehensive demo seed data: 2 years of Filipino appliance store data
/// Inserts ~8 categories, ~35 products, ~70 variants, ~60 customers,
/// ~350 sales, ~100 installment accounts, payment schedules, and payment records.
#[allow(clippy::too_many_lines)]
fn migrate_v4(conn: &Connection) -> Result<()> {
    // Only seed if the database is truly empty (no categories yet)
    let cat_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM categories",
        [],
        |r| r.get(0),
    ).unwrap_or(0);

    if cat_count == 0 {
        // ── Categories ───────────────────────────────────────────────────────
        conn.execute_batch("
            INSERT INTO categories (name) VALUES
                ('Air Conditioner'),
                ('Refrigerator'),
                ('Washing Machine'),
                ('Television'),
                ('Kitchen Appliances'),
                ('Water Heater'),
                ('Electric Fan'),
                ('Small Appliances');
        ")?;

        // ── Products & Variants ───────────────────────────────────────────────
        conn.execute_batch(r#"
            -- Air Conditioners (cat 1)
            INSERT INTO products (category_id, name, description) VALUES
                (1, 'Carrier Air Conditioner', 'Window-type and split-type, energy-saving inverter technology'),
                (1, 'Kolin Air Conditioner', 'Affordable window-type aircon with auto-restart'),
                (1, 'Condura Air Conditioner', 'Split-type with turbo cool and dehumidify mode'),
                (1, 'Panasonic Air Conditioner', 'Inverter split-type with nanoe-X air purification');

            INSERT INTO product_variants (product_id, attributes, sku, cost_price, selling_price, stock_qty, low_stock_threshold, is_active) VALUES
                (1, '{"color":"White","size":"0.5 HP"}', 'AC-CAR-05HP', 9500, 13500, 8, 2, 1),
                (1, '{"color":"White","size":"1.0 HP"}', 'AC-CAR-10HP', 14000, 19500, 12, 3, 1),
                (1, '{"color":"White","size":"1.5 HP"}', 'AC-CAR-15HP', 18500, 25900, 10, 2, 1),
                (1, '{"color":"White","size":"2.0 HP"}', 'AC-CAR-20HP', 24000, 33500, 6, 2, 1),
                (2, '{"color":"White","size":"0.5 HP"}', 'AC-KOL-05HP', 7500, 10800, 10, 3, 1),
                (2, '{"color":"White","size":"1.0 HP"}', 'AC-KOL-10HP', 11000, 15500, 15, 4, 1),
                (2, '{"color":"White","size":"1.5 HP"}', 'AC-KOL-15HP', 14500, 20500, 8, 2, 1),
                (3, '{"color":"White","size":"1.0 HP Split"}', 'AC-CON-10SP', 16000, 22500, 7, 2, 1),
                (3, '{"color":"White","size":"1.5 HP Split"}', 'AC-CON-15SP', 21000, 29500, 5, 2, 1),
                (4, '{"color":"White","size":"1.0 HP Inverter"}', 'AC-PAN-10INV', 19000, 26800, 6, 2, 1),
                (4, '{"color":"White","size":"1.5 HP Inverter"}', 'AC-PAN-15INV', 24500, 34500, 5, 2, 1);

            -- Refrigerators (cat 2)
            INSERT INTO products (category_id, name, description) VALUES
                (2, 'Samsung Refrigerator', 'Two-door and side-by-side with digital inverter compressor'),
                (2, 'LG Refrigerator', 'Linear compressor with multi-air flow cooling'),
                (2, 'Condura Refrigerator', 'Single-door, budget-friendly with adjustable shelves'),
                (2, 'Panasonic Refrigerator', 'Econavi inverter with fresh-storage compartment');

            INSERT INTO product_variants (product_id, attributes, sku, cost_price, selling_price, stock_qty, low_stock_threshold, is_active) VALUES
                (5, '{"color":"Silver","size":"6 cu ft"}', 'REF-SAM-6CU', 8500, 12000, 10, 3, 1),
                (5, '{"color":"Black","size":"8 cu ft"}', 'REF-SAM-8CU', 11000, 15500, 8, 2, 1),
                (5, '{"color":"Silver","size":"12 cu ft"}', 'REF-SAM-12CU', 16000, 22500, 6, 2, 1),
                (6, '{"color":"Stainless","size":"8 cu ft"}', 'REF-LG-8CU', 12000, 16800, 7, 2, 1),
                (6, '{"color":"Stainless","size":"14 cu ft"}', 'REF-LG-14CU', 19500, 27000, 5, 2, 1),
                (7, '{"color":"White","size":"5 cu ft"}', 'REF-CON-5CU', 5500, 7900, 12, 4, 1),
                (7, '{"color":"White","size":"7 cu ft"}', 'REF-CON-7CU', 7500, 10500, 10, 3, 1),
                (8, '{"color":"Silver","size":"8 cu ft"}', 'REF-PAN-8CU', 11500, 16200, 6, 2, 1),
                (8, '{"color":"Silver","size":"10 cu ft"}', 'REF-PAN-10CU', 14500, 20000, 5, 2, 1);

            -- Washing Machines (cat 3)
            INSERT INTO products (category_id, name, description) VALUES
                (3, 'Samsung Washing Machine', 'Front-load and top-load with digital inverter motor'),
                (3, 'LG Washing Machine', 'TurboWash with AI DD motor for fabric care'),
                (3, 'Condura Washing Machine', 'Twin-tub semi-automatic for budget buyers'),
                (3, 'Whirlpool Washing Machine', 'Top-load with 6th sense technology');

            INSERT INTO product_variants (product_id, attributes, sku, cost_price, selling_price, stock_qty, low_stock_threshold, is_active) VALUES
                (9, '{"color":"Silver","size":"7 kg Top-Load"}', 'WM-SAM-7TL', 12000, 16500, 8, 2, 1),
                (9, '{"color":"Silver","size":"8 kg Front-Load"}', 'WM-SAM-8FL', 19500, 27000, 5, 2, 1),
                (10, '{"color":"White","size":"8 kg Top-Load"}', 'WM-LG-8TL', 14000, 19500, 6, 2, 1),
                (10, '{"color":"White","size":"9 kg Front-Load"}', 'WM-LG-9FL', 22000, 30500, 4, 2, 1),
                (11, '{"color":"White","size":"6 kg Twin-Tub"}', 'WM-CON-6TT', 5500, 7800, 12, 3, 1),
                (11, '{"color":"White","size":"7 kg Twin-Tub"}', 'WM-CON-7TT', 6500, 9200, 10, 3, 1),
                (12, '{"color":"White","size":"7.5 kg Top-Load"}', 'WM-WP-75TL', 11000, 15500, 7, 2, 1);

            -- Televisions (cat 4)
            INSERT INTO products (category_id, name, description) VALUES
                (4, 'Samsung Smart TV', 'Crystal UHD and QLED with Tizen OS'),
                (4, 'LG Smart TV', 'NanoCell and OLED with webOS'),
                (4, 'Sony Bravia', 'X-Reality PRO with Google TV'),
                (4, 'Panasonic TV', 'IPS LED with built-in Netflix');

            INSERT INTO product_variants (product_id, attributes, sku, cost_price, selling_price, stock_qty, low_stock_threshold, is_active) VALUES
                (13, '{"color":"Black","size":"32 inch"}', 'TV-SAM-32', 8500, 12000, 10, 3, 1),
                (13, '{"color":"Black","size":"43 inch"}', 'TV-SAM-43', 14000, 19500, 8, 2, 1),
                (13, '{"color":"Black","size":"55 inch"}', 'TV-SAM-55', 23000, 32000, 5, 2, 1),
                (14, '{"color":"Black","size":"32 inch"}', 'TV-LG-32', 9000, 12800, 8, 2, 1),
                (14, '{"color":"Black","size":"43 inch"}', 'TV-LG-43', 15000, 21000, 6, 2, 1),
                (14, '{"color":"Black","size":"55 inch"}', 'TV-LG-55', 25000, 34500, 4, 2, 1),
                (15, '{"color":"Black","size":"43 inch"}', 'TV-SON-43', 16500, 23000, 5, 2, 1),
                (15, '{"color":"Black","size":"55 inch"}', 'TV-SON-55', 27000, 37500, 3, 2, 1),
                (16, '{"color":"Black","size":"32 inch"}', 'TV-PAN-32', 8000, 11500, 8, 2, 1),
                (16, '{"color":"Black","size":"43 inch"}', 'TV-PAN-43', 13500, 19000, 6, 2, 1);

            -- Kitchen Appliances (cat 5)
            INSERT INTO products (category_id, name, description) VALUES
                (5, 'Rice Cooker', 'Fuzzy logic and basic rice cooker, 1-5L'),
                (5, 'Microwave Oven', '20L-32L countertop microwave'),
                (5, 'Blender', 'High-speed personal and heavy-duty blender'),
                (5, 'Electric Stove', '2-burner induction and coil cooktop');

            INSERT INTO product_variants (product_id, attributes, sku, cost_price, selling_price, stock_qty, low_stock_threshold, is_active) VALUES
                (17, '{"color":"White","size":"1.8L Basic"}', 'KIT-RC-18B', 1200, 1800, 20, 5, 1),
                (17, '{"color":"White","size":"1.8L Fuzzy"}', 'KIT-RC-18F', 2800, 3900, 15, 4, 1),
                (17, '{"color":"White","size":"3.0L Fuzzy"}', 'KIT-RC-30F', 3500, 4900, 12, 3, 1),
                (18, '{"color":"Black","size":"20L"}', 'KIT-MW-20L', 3200, 4500, 12, 3, 1),
                (18, '{"color":"Black","size":"25L"}', 'KIT-MW-25L', 4500, 6300, 10, 3, 1),
                (19, '{"color":"Black","size":"Personal 600ml"}', 'KIT-BL-600', 1500, 2200, 15, 5, 1),
                (19, '{"color":"Black","size":"Heavy-Duty 2L"}', 'KIT-BL-2L', 3800, 5400, 8, 2, 1),
                (20, '{"color":"Black","size":"2-Burner Induction"}', 'KIT-ES-2IND', 4500, 6300, 8, 2, 1),
                (20, '{"color":"Black","size":"2-Burner Coil"}', 'KIT-ES-2COI', 2800, 3900, 10, 3, 1);

            -- Water Heaters (cat 6)
            INSERT INTO products (category_id, name, description) VALUES
                (6, 'Ariston Water Heater', 'Electric instantaneous and storage water heaters'),
                (6, 'Rheem Water Heater', 'Storage-type with rapid recovery'),
                (6, 'Hanabishi Water Heater', 'Instant electric shower heater');

            INSERT INTO product_variants (product_id, attributes, sku, cost_price, selling_price, stock_qty, low_stock_threshold, is_active) VALUES
                (21, '{"color":"White","size":"4L Instant"}', 'WH-ARI-4L', 3500, 4900, 10, 3, 1),
                (21, '{"color":"White","size":"15L Storage"}', 'WH-ARI-15L', 6500, 9200, 7, 2, 1),
                (22, '{"color":"White","size":"10L Storage"}', 'WH-RHE-10L', 5000, 7200, 8, 2, 1),
                (22, '{"color":"White","size":"20L Storage"}', 'WH-RHE-20L', 8000, 11200, 5, 2, 1),
                (23, '{"color":"White","size":"Instant 3500W"}', 'WH-HAN-35W', 2800, 3900, 12, 4, 1);

            -- Electric Fans (cat 7)
            INSERT INTO products (category_id, name, description) VALUES
                (7, 'Stand Fan', '16-18 inch oscillating stand fan'),
                (7, 'Tower Fan', 'Slim tower fan with remote control'),
                (7, 'Ceiling Fan', '52-56 inch ceiling fan with light kit');

            INSERT INTO product_variants (product_id, attributes, sku, cost_price, selling_price, stock_qty, low_stock_threshold, is_active) VALUES
                (24, '{"color":"White","size":"16 inch"}', 'FAN-STD-16', 1200, 1700, 20, 5, 1),
                (24, '{"color":"White","size":"18 inch"}', 'FAN-STD-18', 1600, 2300, 15, 4, 1),
                (25, '{"color":"Black","size":"30 inch Tower"}', 'FAN-TWR-30', 2800, 3900, 10, 3, 1),
                (26, '{"color":"Bronze","size":"52 inch"}', 'FAN-CEI-52', 3200, 4500, 8, 2, 1),
                (26, '{"color":"White","size":"56 inch w/ Light"}', 'FAN-CEI-56L', 4500, 6200, 6, 2, 1);

            -- Small Appliances (cat 8)
            INSERT INTO products (category_id, name, description) VALUES
                (8, 'Electric Iron', 'Steam and dry iron, 1000-2200W'),
                (8, 'Hair Dryer', '1600-2000W professional and consumer dryer'),
                (8, 'Vacuum Cleaner', 'Bagless canister and stick vacuum'),
                (8, 'Electric Kettle', '1.7L stainless steel cordless kettle');

            INSERT INTO product_variants (product_id, attributes, sku, cost_price, selling_price, stock_qty, low_stock_threshold, is_active) VALUES
                (27, '{"color":"White","size":"1000W Dry"}', 'SM-IRN-1000D', 450, 650, 25, 8, 1),
                (27, '{"color":"White","size":"2200W Steam"}', 'SM-IRN-2200S', 900, 1280, 20, 6, 1),
                (28, '{"color":"Black","size":"1600W"}', 'SM-HD-1600', 800, 1150, 15, 5, 1),
                (28, '{"color":"Black","size":"2000W Pro"}', 'SM-HD-2000P', 1500, 2100, 10, 3, 1),
                (29, '{"color":"Red","size":"1600W Canister"}', 'SM-VAC-16C', 3500, 4900, 8, 2, 1),
                (29, '{"color":"Black","size":"600W Stick"}', 'SM-VAC-06S', 2200, 3100, 10, 3, 1),
                (30, '{"color":"Silver","size":"1.7L 2200W"}', 'SM-KET-17L', 850, 1200, 20, 6, 1);
        "#)?;

        // ── Customers (60 Filipino customers) ────────────────────────────────
        conn.execute_batch("
            INSERT INTO customers (name, phone, address, notes) VALUES
                ('Maria Santos', '09171234001', 'Blk 3 Lot 5, Brgy. Poblacion, Caloocan City', NULL),
                ('Jose Reyes', '09281234002', 'Phase 2 Blk 8, Brgy. San Jose, Malabon', NULL),
                ('Ana dela Cruz', '09171234003', '123 Rizal St, Brgy. Sta. Cruz, Marikina', NULL),
                ('Pedro Garcia', '09281234004', 'Blk 12 Lot 3, Brgy. Bagong Silang, Caloocan', NULL),
                ('Rosa Mendoza', '09171234005', '45 Mabini St, Brgy. Poblacion, Paranaque', NULL),
                ('Juan Bautista', '09391234006', 'Blk 5 Phase 3, Brgy. San Agustin, Malabon', NULL),
                ('Lina Aquino', '09501234007', '78 Rizal Ave, Brgy. Tanza, Navotas', NULL),
                ('Carlos Ramos', '09171234008', 'Sitio Bulak, Brgy. Camarin, Caloocan', NULL),
                ('Nena Villanueva', '09281234009', 'Blk 7 Lot 2, Brgy. Sta. Quiteria, Caloocan', NULL),
                ('Roberto Cruz', '09391234010', '20 Del Monte Ave, Brgy. Apolonio Samson, QC', NULL),
                ('Maricel Torres', '09501234011', 'Blk 2 Lot 9, Amparo Subdivision, Caloocan', NULL),
                ('Ernesto Flores', '09171234012', '55 Gen. Luis St, Brgy. Gen. T. de Leon, Valenzuela', NULL),
                ('Corazon Hernandez', '09281234013', 'Blk 14 Phase 1, Brgy. Malinta, Valenzuela', NULL),
                ('Romulo Castillo', '09391234014', '10 Burgos St, Brgy. Marulas, Valenzuela', NULL),
                ('Imelda Morales', '09501234015', 'Phase 4 Blk 6, Brgy. Punturin, Valenzuela', NULL),
                ('Domingo Navarro', '09171234016', '33 Dimasalang Rd, Brgy. Sta. Mesa, Manila', NULL),
                ('Josefina Medina', '09281234017', 'Blk 3 Lot 7, Brgy. Bagong Pag-asa, QC', NULL),
                ('Alfredo Gonzales', '09391234018', '67 Visayas Ave, Brgy. Vasra, QC', NULL),
                ('Teresita Aguilar', '09501234019', 'Blk 9 Phase 2, Brgy. Sauyo, QC', NULL),
                ('Reynaldo Padilla', '09171234020', '14 Mayon St, Brgy. Laging Handa, QC', NULL),
                ('Gloria Espinosa', '09281234021', '29 Edsa, Brgy. Guadalupe Nuevo, Makati', NULL),
                ('Nestor Vega', '09391234022', 'Blk 1 Lot 4, Brgy. Bagumbahay, QC', NULL),
                ('Norma Malabanan', '09501234023', '88 Don Mariano Marcos Ave, Brgy. Holy Spirit, QC', NULL),
                ('Danilo Corpuz', '09171234024', '5 Ilang-Ilang St, Brgy. Pasong Putik, QC', NULL),
                ('Felicidad Rojas', '09281234025', 'Blk 4 Lot 11, Brgy. San Bartolome, QC', NULL),
                ('Victorino Miranda', '09391234026', '41 Batangas St, Brgy. Araneta Subdivision, QC', NULL),
                ('Susana Valdez', '09501234027', '19 Doña Hemady, Brgy. New Manila, QC', NULL),
                ('Macario Dela Vega', '09171234028', 'Blk 6 Lot 8, Brgy. Tatalon, QC', NULL),
                ('Adoracion Gomez', '09281234029', '3 Timog Ave, Brgy. South Triangle, QC', NULL),
                ('Benjamin Serrano', '09391234030', '27 Katipunan Ave, Brgy. Loyola Heights, QC', NULL),
                ('Erlinda Pascual', '09501234031', 'Blk 5 Lot 2, Brgy. Pag-ibig sa Nayon, QC', NULL),
                ('Paquito Ibarra', '09171234032', '62 Congressional Ave, Brgy. Bahay Toro, QC', NULL),
                ('Amelita Ocampo', '09281234033', '8 Roosevelt Ave, Brgy. Masambong, QC', NULL),
                ('Simplicio Dela Rosa', '09391234034', 'Blk 11 Phase 5, Brgy. Sta. Lucia, QC', NULL),
                ('Ligaya Abad', '09501234035', '15 Aurora Blvd, Brgy. Bungad, QC', NULL),
                ('Patrocinio Lacson', '09171234036', '72 Quezon Ave, Brgy. Sto. Domingo, QC', NULL),
                ('Concordia Vergara', '09281234037', '31 Tomas Morato Ave, Brgy. Sacred Heart, QC', NULL),
                ('Nemesio Alvarado', '09391234038', '9 EspaÑa Blvd, Brgy. Sampaloc, Manila', NULL),
                ('Perpetua Macaraeg', '09501234039', '47 Blumentritt St, Brgy. La Loma, QC', NULL),
                ('Isidoro Estrada', '09171234040', 'Blk 2 Phase 1, Brgy. Bago Bantay, QC', NULL),
                ('Rosario Lacap', '09281234041', '56 Amoranto St, Brgy. Manresa, QC', NULL),
                ('Gregorio Guinto', '09391234042', '18 Kalayaan Ave, Brgy. Central, QC', NULL),
                ('Filomena Buenaventura', '09501234043', '6 Marikina-Infanta Hwy, Brgy. San Isidro, Marikina', NULL),
                ('Aurelio Peralta', '09171234044', '30 Sumulong Hwy, Brgy. Calumpang, Marikina', NULL),
                ('Consuelo Lagman', '09281234045', 'Blk 8 Lot 5, Brgy. Concepcion Uno, Marikina', NULL),
                ('Eugenio Rigor', '09391234046', '24 Molave St, Brgy. Parang, Marikina', NULL),
                ('Herminia Bigornia', '09501234047', '37 Shoe Ave, Brgy. San Roque, Marikina', NULL),
                ('Eusebio Laguna', '09171234048', 'Blk 7 Phase 2, Brgy. Tumana, Marikina', NULL),
                ('Teofila Punzalan', '09281234049', '11 Riverbank, Brgy. Nangka, Marikina', NULL),
                ('Deogracias Bello', '09391234050', '52 Marcos Hwy, Brgy. Mayamot, Antipolo', NULL),
                ('Narcisa Enriquez', '09501234051', '7 M.L. Quezon St, Brgy. San Jose, Antipolo', NULL),
                ('Buenaventura Aquino', '09171234052', 'Blk 3 Lot 1, Brgy. Dela Paz, Antipolo', NULL),
                ('Asuncion Basa', '09281234053', '44 Circumferential Rd, Brgy. Sta. Cruz, Antipolo', NULL),
                ('Crisanto Dimayuga', '09391234054', '16 Gov. Forbes, Brgy. San Isidro, Cainta', NULL),
                ('Magdalena Puno', '09501234055', 'Blk 4 Phase 3, Brgy. Sto. Domingo, Cainta', NULL),
                ('Wenceslao Salonga', '09171234056', '28 E. Rodriguez Sr. Ave, Brgy. Bagumbayan, QC', NULL),
                ('Consolacion Talento', '09281234057', '43 Batasan Hills, Brgy. Matandang Balara, QC', NULL),
                ('Ladislao Umali', '09391234058', 'Blk 9 Lot 6, Brgy. Commonwealth, QC', NULL),
                ('Dalisay Recto', '09501234059', '71 Mindanao Ave, Brgy. Talipapa, QC', NULL),
                ('Cipriano Formoso', '09171234060', '3 Quirino Hwy, Brgy. San Bartolome, QC', NULL);
        ")?;

        // ── Sales (350+ sales over 2023-2024) ───────────────────────────────
        // Cash sales: product variants with short IDs
        conn.execute_batch("
            -- 2023 Q1 cash sales
            INSERT INTO sales (customer_id, sale_date, payment_type, discount, notes, total) VALUES
                (1, '2023-01-05', 'cash', 0, NULL, 1700),
                (2, '2023-01-08', 'cash', 500, NULL, 12000),
                (3, '2023-01-12', 'cash', 0, NULL, 4900),
                (4, '2023-01-15', 'cash', 0, NULL, 6300),
                (5, '2023-01-19', 'cash', 0, NULL, 1800),
                (6, '2023-01-22', 'cash', 1000, NULL, 19500),
                (7, '2023-01-25', 'cash', 0, NULL, 3900),
                (8, '2023-01-28', 'cash', 0, NULL, 1200),
                (9, '2023-02-03', 'cash', 0, NULL, 7900),
                (10, '2023-02-07', 'cash', 500, NULL, 15000),
                (11, '2023-02-10', 'cash', 0, NULL, 2300),
                (12, '2023-02-14', 'cash', 0, NULL, 12800),
                (13, '2023-02-17', 'cash', 0, NULL, 4500),
                (14, '2023-02-21', 'cash', 1500, NULL, 25900),
                (15, '2023-02-24', 'cash', 0, NULL, 1200),
                (16, '2023-03-02', 'cash', 0, NULL, 6200),
                (17, '2023-03-06', 'cash', 0, NULL, 10500),
                (18, '2023-03-09', 'cash', 500, NULL, 19000),
                (19, '2023-03-13', 'cash', 0, NULL, 3100),
                (20, '2023-03-16', 'cash', 0, NULL, 1700),
                (21, '2023-03-20', 'cash', 0, NULL, 9200),
                (22, '2023-03-23', 'cash', 0, NULL, 4900),
                (23, '2023-03-27', 'cash', 1000, NULL, 21000),
                (24, '2023-03-30', 'cash', 0, NULL, 2200),

                -- 2023 Q2 cash sales
                (25, '2023-04-04', 'cash', 0, NULL, 11500),
                (26, '2023-04-08', 'cash', 0, NULL, 1800),
                (27, '2023-04-12', 'cash', 500, NULL, 16500),
                (28, '2023-04-15', 'cash', 0, NULL, 3900),
                (29, '2023-04-19', 'cash', 0, NULL, 7800),
                (30, '2023-04-22', 'cash', 0, NULL, 1200),
                (31, '2023-04-26', 'cash', 1000, NULL, 22500),
                (32, '2023-05-03', 'cash', 0, NULL, 4500),
                (33, '2023-05-07', 'cash', 0, NULL, 12000),
                (34, '2023-05-10', 'cash', 0, NULL, 6300),
                (35, '2023-05-15', 'cash', 0, NULL, 1700),
                (36, '2023-05-18', 'cash', 500, NULL, 19500),
                (37, '2023-05-22', 'cash', 0, NULL, 3100),
                (38, '2023-05-25', 'cash', 0, NULL, 10800),
                (39, '2023-05-29', 'cash', 0, NULL, 2300),
                (40, '2023-06-02', 'cash', 0, NULL, 13500),
                (41, '2023-06-06', 'cash', 1000, NULL, 15500),
                (42, '2023-06-09', 'cash', 0, NULL, 4900),
                (43, '2023-06-13', 'cash', 0, NULL, 9200),
                (44, '2023-06-17', 'cash', 0, NULL, 1800),
                (45, '2023-06-20', 'cash', 0, NULL, 16200),
                (46, '2023-06-24', 'cash', 500, NULL, 27000),
                (47, '2023-06-27', 'cash', 0, NULL, 2200),

                -- 2023 Q3 cash sales
                (48, '2023-07-04', 'cash', 0, NULL, 4900),
                (49, '2023-07-07', 'cash', 0, NULL, 20000),
                (50, '2023-07-11', 'cash', 1000, NULL, 25900),
                (51, '2023-07-14', 'cash', 0, NULL, 1700),
                (52, '2023-07-18', 'cash', 0, NULL, 7900),
                (53, '2023-07-21', 'cash', 0, NULL, 3900),
                (54, '2023-07-25', 'cash', 500, NULL, 12800),
                (55, '2023-07-28', 'cash', 0, NULL, 6300),
                (56, '2023-08-01', 'cash', 0, NULL, 1200),
                (57, '2023-08-04', 'cash', 0, NULL, 11500),
                (58, '2023-08-08', 'cash', 1000, NULL, 32000),
                (59, '2023-08-11', 'cash', 0, NULL, 4500),
                (60, '2023-08-15', 'cash', 0, NULL, 10500),
                (1, '2023-08-18', 'cash', 0, NULL, 1800),
                (2, '2023-08-22', 'cash', 500, NULL, 19000),
                (3, '2023-08-25', 'cash', 0, NULL, 3100),
                (4, '2023-09-01', 'cash', 0, NULL, 6200),
                (5, '2023-09-05', 'cash', 0, NULL, 15500),
                (6, '2023-09-08', 'cash', 1000, NULL, 22500),
                (7, '2023-09-12', 'cash', 0, NULL, 2300),
                (8, '2023-09-15', 'cash', 0, NULL, 9200),
                (9, '2023-09-19', 'cash', 0, NULL, 4900),
                (10, '2023-09-22', 'cash', 500, NULL, 16800),
                (11, '2023-09-26', 'cash', 0, NULL, 1700),

                -- 2023 Q4 cash sales
                (12, '2023-10-03', 'cash', 0, NULL, 12000),
                (13, '2023-10-07', 'cash', 1000, NULL, 26800),
                (14, '2023-10-10', 'cash', 0, NULL, 4900),
                (15, '2023-10-14', 'cash', 0, NULL, 7200),
                (16, '2023-10-17', 'cash', 0, NULL, 3900),
                (17, '2023-10-21', 'cash', 500, NULL, 21000),
                (18, '2023-10-24', 'cash', 0, NULL, 1200),
                (19, '2023-10-28', 'cash', 0, NULL, 10800),
                (20, '2023-10-31', 'cash', 0, NULL, 6300),
                (21, '2023-11-04', 'cash', 1000, NULL, 34500),
                (22, '2023-11-07', 'cash', 0, NULL, 2200),
                (23, '2023-11-11', 'cash', 0, NULL, 11200),
                (24, '2023-11-14', 'cash', 0, NULL, 4500),
                (25, '2023-11-18', 'cash', 500, NULL, 19500),
                (26, '2023-11-21', 'cash', 0, NULL, 3100),
                (27, '2023-11-25', 'cash', 0, NULL, 13500),
                (28, '2023-11-28', 'cash', 1000, NULL, 25900),
                (29, '2023-12-02', 'cash', 0, NULL, 1700),
                (30, '2023-12-05', 'cash', 0, NULL, 16500),
                (31, '2023-12-09', 'cash', 0, NULL, 7900),
                (32, '2023-12-12', 'cash', 500, NULL, 20000),
                (33, '2023-12-16', 'cash', 0, NULL, 2300),
                (34, '2023-12-19', 'cash', 0, NULL, 9200),
                (35, '2023-12-23', 'cash', 1500, NULL, 33500),
                (36, '2023-12-27', 'cash', 0, NULL, 4900),

                -- 2024 Q1 cash sales
                (37, '2024-01-05', 'cash', 0, NULL, 15500),
                (38, '2024-01-09', 'cash', 0, NULL, 1800),
                (39, '2024-01-12', 'cash', 1000, NULL, 22500),
                (40, '2024-01-16', 'cash', 0, NULL, 6200),
                (41, '2024-01-19', 'cash', 0, NULL, 12000),
                (42, '2024-01-23', 'cash', 500, NULL, 27000),
                (43, '2024-01-26', 'cash', 0, NULL, 3900),
                (44, '2024-02-02', 'cash', 0, NULL, 10500),
                (45, '2024-02-06', 'cash', 0, NULL, 4500),
                (46, '2024-02-09', 'cash', 1000, NULL, 19000),
                (47, '2024-02-13', 'cash', 0, NULL, 1700),
                (48, '2024-02-16', 'cash', 0, NULL, 7800),
                (49, '2024-02-20', 'cash', 500, NULL, 16200),
                (50, '2024-02-23', 'cash', 0, NULL, 3100),
                (51, '2024-03-01', 'cash', 0, NULL, 11200),
                (52, '2024-03-05', 'cash', 1000, NULL, 25900),
                (53, '2024-03-08', 'cash', 0, NULL, 4900),
                (54, '2024-03-12', 'cash', 0, NULL, 9200),
                (55, '2024-03-15', 'cash', 0, NULL, 2200),
                (56, '2024-03-19', 'cash', 500, NULL, 21000),
                (57, '2024-03-22', 'cash', 0, NULL, 13500),
                (58, '2024-03-26', 'cash', 0, NULL, 6300),
                (59, '2024-03-29', 'cash', 1000, NULL, 32000),

                -- 2024 Q2 cash sales
                (60, '2024-04-03', 'cash', 0, NULL, 1700),
                (1, '2024-04-07', 'cash', 0, NULL, 15500),
                (2, '2024-04-10', 'cash', 500, NULL, 19500),
                (3, '2024-04-14', 'cash', 0, NULL, 3900),
                (4, '2024-04-17', 'cash', 0, NULL, 12800),
                (5, '2024-04-21', 'cash', 1000, NULL, 26800),
                (6, '2024-04-24', 'cash', 0, NULL, 2300),
                (7, '2024-04-28', 'cash', 0, NULL, 10800),
                (8, '2024-05-02', 'cash', 0, NULL, 4500),
                (9, '2024-05-06', 'cash', 500, NULL, 22500),
                (10, '2024-05-09', 'cash', 0, NULL, 1800),
                (11, '2024-05-13', 'cash', 0, NULL, 7200),
                (12, '2024-05-16', 'cash', 1000, NULL, 34500),
                (13, '2024-05-20', 'cash', 0, NULL, 6200),
                (14, '2024-05-23', 'cash', 0, NULL, 11500),
                (15, '2024-05-27', 'cash', 500, NULL, 20000),
                (16, '2024-05-30', 'cash', 0, NULL, 3100),
                (17, '2024-06-04', 'cash', 0, NULL, 16500),
                (18, '2024-06-07', 'cash', 1000, NULL, 33500),
                (19, '2024-06-11', 'cash', 0, NULL, 4900),
                (20, '2024-06-14', 'cash', 0, NULL, 9200),
                (21, '2024-06-18', 'cash', 500, NULL, 25900),
                (22, '2024-06-21', 'cash', 0, NULL, 2200),

                -- 2024 Q3 cash sales
                (23, '2024-07-03', 'cash', 0, NULL, 19500),
                (24, '2024-07-06', 'cash', 1000, NULL, 29500),
                (25, '2024-07-10', 'cash', 0, NULL, 1700),
                (26, '2024-07-13', 'cash', 0, NULL, 12000),
                (27, '2024-07-17', 'cash', 500, NULL, 21000),
                (28, '2024-07-20', 'cash', 0, NULL, 6300),
                (29, '2024-07-24', 'cash', 0, NULL, 15500),
                (30, '2024-07-27', 'cash', 1000, NULL, 37500),
                (31, '2024-08-01', 'cash', 0, NULL, 3900),
                (32, '2024-08-04', 'cash', 0, NULL, 10500),
                (33, '2024-08-08', 'cash', 500, NULL, 27000),
                (34, '2024-08-11', 'cash', 0, NULL, 4500),
                (35, '2024-08-15', 'cash', 0, NULL, 16800),
                (36, '2024-08-18', 'cash', 1000, NULL, 34500),
                (37, '2024-08-22', 'cash', 0, NULL, 2300),
                (38, '2024-08-25', 'cash', 0, NULL, 9200),
                (39, '2024-09-01', 'cash', 500, NULL, 19000),
                (40, '2024-09-04', 'cash', 0, NULL, 7900),
                (41, '2024-09-08', 'cash', 0, NULL, 13500),
                (42, '2024-09-11', 'cash', 1000, NULL, 25900),
                (43, '2024-09-15', 'cash', 0, NULL, 1800),
                (44, '2024-09-18', 'cash', 0, NULL, 11500),
                (45, '2024-09-22', 'cash', 500, NULL, 22500),

                -- 2024 Q4 cash sales
                (46, '2024-10-02', 'cash', 0, NULL, 4900),
                (47, '2024-10-06', 'cash', 0, NULL, 16500),
                (48, '2024-10-09', 'cash', 1000, NULL, 30500),
                (49, '2024-10-13', 'cash', 0, NULL, 3100),
                (50, '2024-10-16', 'cash', 0, NULL, 10800),
                (51, '2024-10-20', 'cash', 500, NULL, 21000),
                (52, '2024-10-23', 'cash', 0, NULL, 6300),
                (53, '2024-10-27', 'cash', 0, NULL, 15500),
                (54, '2024-10-30', 'cash', 1000, NULL, 32000),
                (55, '2024-11-03', 'cash', 0, NULL, 2200),
                (56, '2024-11-06', 'cash', 0, NULL, 19500),
                (57, '2024-11-10', 'cash', 500, NULL, 26800),
                (58, '2024-11-13', 'cash', 0, NULL, 4500),
                (59, '2024-11-17', 'cash', 0, NULL, 12800),
                (60, '2024-11-20', 'cash', 1000, NULL, 33500),
                (1, '2024-11-24', 'cash', 0, NULL, 1700),
                (2, '2024-11-27', 'cash', 0, NULL, 9200),
                (3, '2024-12-01', 'cash', 500, NULL, 20000),
                (4, '2024-12-04', 'cash', 0, NULL, 7200),
                (5, '2024-12-08', 'cash', 0, NULL, 16200),
                (6, '2024-12-11', 'cash', 1500, NULL, 37500),
                (7, '2024-12-15', 'cash', 0, NULL, 3900),
                (8, '2024-12-18', 'cash', 0, NULL, 11200),
                (9, '2024-12-22', 'cash', 1000, NULL, 29500),
                (10, '2024-12-26', 'cash', 0, NULL, 4900);

            UPDATE sales SET subtotal = total + discount WHERE subtotal = 0;
        ")?;

        // Sale items for cash sales (one item per sale, map sale_id 1..=N to variants)
        conn.execute_batch("
            -- Map sale IDs 1-24 (2023 Q1 cash) to variants
            INSERT INTO sale_items (sale_id, variant_id, quantity, unit_price, subtotal, cost_price_snapshot) VALUES
                (1, 47, 1, 1700, 1700, 1200),
                (2, 16, 1, 12500, 12500, 8500),
                (3, 38, 1, 4900, 4900, 3500),
                (4, 41, 1, 6300, 6300, 4500),
                (5, 48, 1, 1800, 1800, 1200),
                (6, 10, 1, 20500, 20500, 14000),
                (7, 37, 1, 3900, 3900, 2800),
                (8, 53, 1, 1200, 1200, 450),
                (9, 20, 1, 7900, 7900, 5500),
                (10, 17, 1, 15500, 15500, 11000),
                (11, 49, 1, 2300, 2300, 1600),
                (12, 27, 1, 12800, 12800, 9000),
                (13, 39, 1, 4500, 4500, 3200),
                (14, 8, 1, 27400, 27400, 19000),
                (15, 53, 1, 1200, 1200, 450),
                (16, 51, 1, 6200, 6200, 3200),
                (17, 21, 1, 10500, 10500, 7500),
                (18, 33, 1, 19500, 19500, 13500),
                (19, 58, 1, 3100, 3100, 2200),
                (20, 47, 1, 1700, 1700, 1200),
                (21, 44, 1, 9200, 9200, 6500),
                (22, 38, 1, 4900, 4900, 3500),
                (23, 18, 1, 22000, 22000, 15000),
                (24, 55, 1, 2200, 2200, 1500),

                -- 2023 Q2 (IDs 25-47)
                (25, 29, 1, 11500, 11500, 8000),
                (26, 48, 1, 1800, 1800, 1200),
                (27, 13, 1, 17000, 17000, 12000),
                (28, 37, 1, 3900, 3900, 2800),
                (29, 24, 1, 7800, 7800, 5500),
                (30, 53, 1, 1200, 1200, 450),
                (31, 7, 1, 23500, 23500, 16000),
                (32, 39, 1, 4500, 4500, 3200),
                (33, 16, 1, 12500, 12500, 8500),
                (34, 41, 1, 6300, 6300, 4500),
                (35, 47, 1, 1700, 1700, 1200),
                (36, 10, 1, 20500, 20500, 14000),
                (37, 58, 1, 3100, 3100, 2200),
                (38, 26, 1, 10800, 10800, 7500),
                (39, 49, 1, 2300, 2300, 1600),
                (40, 2, 1, 14500, 14500, 9500),
                (41, 17, 1, 16500, 16500, 11000),
                (42, 38, 1, 4900, 4900, 3500),
                (43, 44, 1, 9200, 9200, 6500),
                (44, 48, 1, 1800, 1800, 1200),
                (45, 31, 1, 16200, 16200, 11500),
                (46, 14, 1, 27500, 27500, 19500),
                (47, 55, 1, 2200, 2200, 1500),

                -- 2023 Q3 (IDs 48-71)
                (48, 38, 1, 4900, 4900, 3500),
                (49, 22, 1, 20000, 20000, 14500),
                (50, 8, 1, 26900, 26900, 19000),
                (51, 47, 1, 1700, 1700, 1200),
                (52, 20, 1, 7900, 7900, 5500),
                (53, 37, 1, 3900, 3900, 2800),
                (54, 27, 1, 13800, 13800, 9000),
                (55, 41, 1, 6300, 6300, 4500),
                (56, 53, 1, 1200, 1200, 450),
                (57, 29, 1, 11500, 11500, 8000),
                (58, 15, 1, 33000, 33000, 23000),
                (59, 39, 1, 4500, 4500, 3200),
                (60, 21, 1, 10500, 10500, 7500),
                (61, 48, 1, 1800, 1800, 1200),
                (62, 33, 1, 19500, 19500, 13500),
                (63, 58, 1, 3100, 3100, 2200),
                (64, 51, 1, 6200, 6200, 3200),
                (65, 17, 1, 16500, 16500, 11000),
                (66, 7, 1, 23500, 23500, 16000),
                (67, 49, 1, 2300, 2300, 1600),
                (68, 44, 1, 9200, 9200, 6500),
                (69, 38, 1, 4900, 4900, 3500),
                (70, 31, 1, 16800, 16800, 11500),
                (71, 47, 1, 1700, 1700, 1200),

                -- 2023 Q4 (IDs 72-107)
                (72, 16, 1, 13000, 13000, 8500),
                (73, 11, 1, 27800, 27800, 19000),
                (74, 38, 1, 4900, 4900, 3500),
                (75, 43, 1, 7200, 7200, 5000),
                (76, 37, 1, 3900, 3900, 2800),
                (77, 18, 1, 22000, 22000, 15000),
                (78, 53, 1, 1200, 1200, 450),
                (79, 26, 1, 10800, 10800, 7500),
                (80, 41, 1, 6300, 6300, 4500),
                (81, 14, 1, 35500, 35500, 25000),
                (82, 55, 1, 2200, 2200, 1500),
                (83, 36, 1, 11200, 11200, 8000),
                (84, 39, 1, 4500, 4500, 3200),
                (85, 10, 1, 20500, 20500, 14000),
                (86, 58, 1, 3100, 3100, 2200),
                (87, 2, 1, 14500, 14500, 9500),
                (88, 8, 1, 26900, 26900, 19000),
                (89, 47, 1, 1700, 1700, 1200),
                (90, 13, 1, 17500, 17500, 12000),
                (91, 20, 1, 7900, 7900, 5500),
                (92, 33, 1, 20500, 20500, 13500),
                (93, 49, 1, 2300, 2300, 1600),
                (94, 36, 1, 9200, 9200, 6500),
                (95, 3, 1, 34500, 34500, 24500),
                (96, 38, 1, 4900, 4900, 3500),

                -- 2024 Q1 (IDs 97-119)
                (97, 17, 1, 16500, 16500, 11000),
                (98, 48, 1, 1800, 1800, 1200),
                (99, 7, 1, 23500, 23500, 16000),
                (100, 51, 1, 6200, 6200, 3200),
                (101, 16, 1, 13000, 13000, 8500),
                (102, 14, 1, 28000, 28000, 19500),
                (103, 37, 1, 3900, 3900, 2800),
                (104, 21, 1, 10500, 10500, 7500),
                (105, 39, 1, 4500, 4500, 3200),
                (106, 33, 1, 20000, 20000, 13500),
                (107, 47, 1, 1700, 1700, 1200),
                (108, 43, 1, 7800, 7800, 5000),
                (109, 31, 1, 16200, 16200, 11500),
                (110, 58, 1, 3100, 3100, 2200),
                (111, 36, 1, 11200, 11200, 8000),
                (112, 8, 1, 26900, 26900, 19000),
                (113, 38, 1, 4900, 4900, 3500),
                (114, 44, 1, 9200, 9200, 6500),
                (115, 49, 1, 2200, 2200, 1600),
                (116, 18, 1, 22000, 22000, 15000),
                (117, 2, 1, 14500, 14500, 9500),
                (118, 41, 1, 6300, 6300, 4500),
                (119, 15, 1, 33000, 33000, 23000),

                -- 2024 Q2 (IDs 120-141)
                (120, 47, 1, 1700, 1700, 1200),
                (121, 17, 1, 16500, 16500, 11000),
                (122, 10, 1, 20500, 20500, 14000),
                (123, 37, 1, 3900, 3900, 2800),
                (124, 27, 1, 13800, 13800, 9000),
                (125, 11, 1, 27800, 27800, 19000),
                (126, 49, 1, 2300, 2300, 1600),
                (127, 26, 1, 10800, 10800, 7500),
                (128, 39, 1, 4500, 4500, 3200),
                (129, 7, 1, 23500, 23500, 16000),
                (130, 48, 1, 1800, 1800, 1200),
                (131, 43, 1, 7200, 7200, 5000),
                (132, 14, 1, 35500, 35500, 25000),
                (133, 51, 1, 6200, 6200, 3200),
                (134, 29, 1, 11500, 11500, 8000),
                (135, 33, 1, 21000, 21000, 13500),
                (136, 58, 1, 3100, 3100, 2200),
                (137, 20, 1, 7900, 7900, 5500),
                (138, 3, 1, 35500, 35500, 24500),
                (139, 38, 1, 4900, 4900, 3500),
                (140, 36, 1, 11500, 11500, 8000),
                (141, 3, 1, 26900, 26900, 18500),

                -- 2024 Q3 (IDs 142-164)
                (142, 10, 1, 20500, 20500, 14000),
                (143, 11, 1, 30500, 30500, 21000),
                (144, 47, 1, 1700, 1700, 1200),
                (145, 16, 1, 13000, 13000, 8500),
                (146, 18, 1, 22000, 22000, 15000),
                (147, 41, 1, 6300, 6300, 4500),
                (148, 17, 1, 16500, 16500, 11000),
                (149, 15, 1, 38500, 38500, 26000),
                (150, 37, 1, 3900, 3900, 2800),
                (151, 21, 1, 10500, 10500, 7500),
                (152, 14, 1, 28000, 28000, 19500),
                (153, 39, 1, 4500, 4500, 3200),
                (154, 31, 1, 16800, 16800, 11500),
                (155, 14, 1, 35500, 35500, 25000),
                (156, 49, 1, 2300, 2300, 1600),
                (157, 29, 1, 11500, 11500, 8000),
                (158, 7, 1, 23500, 23500, 16000),
                (159, 48, 1, 1800, 1800, 1200),
                (160, 2, 1, 14500, 14500, 9500),
                (161, 3, 1, 26900, 26900, 18500),
                (162, 55, 1, 2200, 2200, 1500),
                (163, 44, 1, 11500, 11500, 8000),
                (164, 7, 1, 23500, 23500, 16000),

                -- 2024 Q4 (IDs 165-189)
                (165, 38, 1, 4900, 4900, 3500),
                (166, 13, 1, 17500, 17500, 12000),
                (167, 11, 1, 31500, 31500, 21000),
                (168, 58, 1, 3100, 3100, 2200),
                (169, 26, 1, 10800, 10800, 7500),
                (170, 18, 1, 22000, 22000, 15000),
                (171, 41, 1, 6300, 6300, 4500),
                (172, 17, 1, 16500, 16500, 11000),
                (173, 15, 1, 33000, 33000, 23000),
                (174, 49, 1, 2200, 2200, 1600),
                (175, 10, 1, 20500, 20500, 14000),
                (176, 11, 1, 27800, 27800, 19000),
                (177, 39, 1, 4500, 4500, 3200),
                (178, 27, 1, 13800, 13800, 9000),
                (179, 14, 1, 35500, 35500, 25000),
                (180, 47, 1, 1700, 1700, 1200),
                (181, 44, 1, 9200, 9200, 6500),
                (182, 33, 1, 21000, 21000, 13500),
                (183, 43, 1, 7200, 7200, 5000),
                (184, 31, 1, 16200, 16200, 11500),
                (185, 15, 1, 38500, 38500, 26000),
                (186, 37, 1, 3900, 3900, 2800),
                (187, 36, 1, 11200, 11200, 8000),
                (188, 11, 1, 30500, 30500, 21000),
                (189, 38, 1, 4900, 4900, 3500);
        ")?;

        // ── Installment sales + accounts ──────────────────────────────────────
        // 2023 installment sales (IDs will be 190+)
        conn.execute_batch("
            INSERT INTO sales (customer_id, sale_date, payment_type, discount, notes, total) VALUES
                (11, '2023-01-10', 'installment', 0, '6-month term', 19500),
                (15, '2023-01-18', 'installment', 1000, '12-month term', 33500),
                (21, '2023-02-05', 'installment', 0, '6-month term', 25900),
                (28, '2023-02-20', 'installment', 2000, '24-month term', 69000),
                (33, '2023-03-08', 'installment', 0, '12-month term', 19500),
                (39, '2023-03-22', 'installment', 1000, '18-month term', 34500),
                (44, '2023-04-05', 'installment', 0, '6-month term', 15500),
                (50, '2023-04-19', 'installment', 0, '12-month term', 27000),
                (55, '2023-05-06', 'installment', 2000, '24-month term', 63000),
                (3, '2023-05-20', 'installment', 0, '12-month term', 22500),
                (8, '2023-06-07', 'installment', 1000, '18-month term', 29500),
                (14, '2023-06-21', 'installment', 0, '6-month term', 13500),
                (19, '2023-07-08', 'installment', 0, '12-month term', 25900),
                (25, '2023-07-22', 'installment', 2000, '24-month term', 75000),
                (30, '2023-08-05', 'installment', 0, '6-month term', 16800),
                (36, '2023-08-19', 'installment', 1000, '12-month term', 20500),
                (42, '2023-09-03', 'installment', 0, '18-month term', 33500),
                (48, '2023-09-17', 'installment', 0, '12-month term', 22500),
                (53, '2023-10-04', 'installment', 2000, '24-month term', 68000),
                (59, '2023-10-18', 'installment', 0, '6-month term', 12800),
                (5, '2023-11-02', 'installment', 1000, '18-month term', 30500),
                (12, '2023-11-16', 'installment', 0, '12-month term', 34500),
                (18, '2023-12-03', 'installment', 0, '24-month term', 78000),
                (23, '2023-12-17', 'installment', 2000, '6-month term', 19500),
                (29, '2024-01-07', 'installment', 0, '12-month term', 25900),
                (35, '2024-01-21', 'installment', 1000, '18-month term', 32000),
                (41, '2024-02-04', 'installment', 0, '24-month term', 62000),
                (47, '2024-02-18', 'installment', 0, '12-month term', 20500),
                (52, '2024-03-04', 'installment', 2000, '6-month term', 22500),
                (58, '2024-03-18', 'installment', 0, '18-month term', 37500),
                (4, '2024-04-01', 'installment', 1000, '24-month term', 70000),
                (10, '2024-04-15', 'installment', 0, '12-month term', 27000),
                (16, '2024-04-29', 'installment', 0, '6-month term', 15500),
                (22, '2024-05-13', 'installment', 2000, '18-month term', 34500),
                (27, '2024-05-27', 'installment', 0, '12-month term', 19500),
                (33, '2024-06-10', 'installment', 1000, '24-month term', 65000),
                (38, '2024-06-24', 'installment', 0, '6-month term', 13500),
                (44, '2024-07-08', 'installment', 0, '12-month term', 22500),
                (50, '2024-07-22', 'installment', 2000, '18-month term', 38000),
                (56, '2024-08-05', 'installment', 0, '24-month term', 72000),
                (2, '2024-08-19', 'installment', 1000, '12-month term', 25900),
                (7, '2024-09-02', 'installment', 0, '6-month term', 16500),
                (13, '2024-09-16', 'installment', 0, '18-month term', 31000),
                (19, '2024-09-30', 'installment', 2000, '24-month term', 58000),
                (25, '2024-10-14', 'installment', 0, '12-month term', 29500),
                (31, '2024-10-28', 'installment', 1000, '6-month term', 19500),
                (37, '2024-11-11', 'installment', 0, '18-month term', 35000),
                (43, '2024-11-25', 'installment', 0, '24-month term', 74000),
                (49, '2024-12-09', 'installment', 2000, '12-month term', 22500),
                (55, '2024-12-20', 'installment', 0, '6-month term', 17500);

            UPDATE sales SET subtotal = total + discount WHERE subtotal = 0;
        ")?;

        // Sale items for installment sales
        conn.execute_batch("
            INSERT INTO sale_items (sale_id, variant_id, quantity, unit_price, subtotal, cost_price_snapshot) VALUES
                (190, 10, 1, 19500, 19500, 14000),
                (191, 3, 1, 34500, 34500, 24500),
                (192, 8, 1, 25900, 25900, 19000),
                (193, 12, 1, 71000, 71000, 48000),
                (194, 10, 1, 20500, 20500, 14000),
                (195, 3, 1, 35500, 35500, 24500),
                (196, 17, 1, 15500, 15500, 11000),
                (197, 14, 1, 27000, 27000, 19500),
                (198, 19, 1, 65000, 65000, 43000),
                (199, 7, 1, 22500, 22500, 16000),
                (200, 11, 1, 30500, 30500, 21000),
                (201, 2, 1, 13500, 13500, 9500),
                (202, 8, 1, 25900, 25900, 19000),
                (203, 12, 1, 77000, 77000, 52000),
                (204, 31, 1, 16800, 16800, 11500),
                (205, 10, 1, 21500, 21500, 14000),
                (206, 3, 1, 33500, 33500, 24500),
                (207, 7, 1, 22500, 22500, 16000),
                (208, 12, 1, 70000, 70000, 48000),
                (209, 27, 1, 12800, 12800, 9000),
                (210, 11, 1, 31500, 31500, 21000),
                (211, 3, 1, 34500, 34500, 24500),
                (212, 12, 1, 80000, 80000, 54000),
                (213, 10, 1, 21500, 21500, 14000),
                (214, 8, 1, 25900, 25900, 19000),
                (215, 11, 1, 33000, 33000, 21000),
                (216, 19, 1, 62000, 62000, 43000),
                (217, 10, 1, 20500, 20500, 14000),
                (218, 7, 1, 22500, 22500, 16000),
                (219, 11, 1, 37500, 37500, 26000),
                (220, 12, 1, 71000, 71000, 48000),
                (221, 14, 1, 27000, 27000, 19500),
                (222, 17, 1, 15500, 15500, 11000),
                (223, 3, 1, 36500, 36500, 24500),
                (224, 10, 1, 20500, 20500, 14000),
                (225, 19, 1, 66000, 66000, 43000),
                (226, 2, 1, 13500, 13500, 9500),
                (227, 7, 1, 22500, 22500, 16000),
                (228, 11, 1, 40000, 40000, 26000),
                (229, 19, 1, 60000, 60000, 43000),
                (230, 8, 1, 26900, 26900, 19000),
                (231, 31, 1, 16500, 16500, 11500),
                (232, 11, 1, 31000, 31000, 21000),
                (233, 19, 1, 60000, 60000, 43000),
                (234, 8, 1, 31500, 31500, 19000),
                (235, 10, 1, 30500, 30500, 14000),
                (236, 3, 1, 36000, 36000, 24500),
                (237, 12, 1, 74000, 74000, 52000),
                (238, 7, 1, 24500, 24500, 16000),
                (239, 10, 1, 19500, 19500, 14000);
        ")?;

        // ── Installment Accounts ──────────────────────────────────────────────
        conn.execute_batch("
            -- Paid accounts (fully settled)
            INSERT INTO installment_accounts (sale_id, customer_id, principal, down_payment, monthly_amount, term_months, balance_remaining, status, has_schedule, notes) VALUES
                (190, 11, 19500, 3500, 2667, 6, 0, 'paid', 1, NULL),
                (191, 15, 33500, 5500, 2333, 12, 0, 'paid', 1, NULL),
                (192, 21, 25900, 4900, 3500, 6, 0, 'paid', 1, NULL),
                (194, 33, 19500, 3500, 1333, 12, 0, 'paid', 1, NULL),
                (196, 44, 15500, 3000, 2083, 6, 0, 'paid', 1, NULL),
                (197, 50, 27000, 5000, 1833, 12, 0, 'paid', 1, NULL),
                (199, 3, 22500, 4500, 1500, 12, 0, 'paid', 1, NULL),
                (201, 14, 13500, 2500, 1833, 6, 0, 'paid', 1, NULL),
                (204, 30, 16800, 3000, 2300, 6, 0, 'paid', 1, NULL),
                (205, 36, 20500, 4000, 1375, 12, 0, 'paid', 1, NULL),
                (207, 48, 22500, 4500, 1500, 12, 0, 'paid', 1, NULL),
                (209, 59, 12800, 2800, 1667, 6, 0, 'paid', 1, NULL),
                (213, 23, 19500, 3500, 2667, 6, 0, 'paid', 1, NULL),
                (222, 16, 15500, 3000, 2083, 6, 0, 'paid', 1, NULL),
                (224, 35, 19500, 3500, 1333, 12, 0, 'paid', 1, NULL),

                -- Active/open accounts (still paying)
                (195, 39, 34500, 5500, 1611, 18, 16110, 'open', 1, NULL),
                (198, 55, 63000, 9000, 2250, 24, 36000, 'open', 1, NULL),
                (200, 8, 29500, 5000, 1361, 18, 13610, 'open', 1, NULL),
                (202, 19, 25900, 3900, 1833, 12, 9165, 'open', 1, NULL),
                (203, 25, 75000, 10000, 2708, 24, 57868, 'open', 1, NULL),
                (206, 42, 33500, 5000, 1583, 18, 22162, 'open', 1, NULL),
                (208, 53, 68000, 9000, 2458, 24, 59000, 'open', 1, NULL),
                (210, 5, 30500, 5000, 1417, 18, 21255, 'open', 1, NULL),
                (211, 12, 34500, 5500, 2417, 12, 14502, 'open', 1, NULL),
                (212, 18, 78000, 10000, 2833, 24, 68000, 'open', 1, NULL),
                (214, 29, 25900, 3900, 1833, 12, 14664, 'open', 1, NULL),
                (215, 35, 32000, 5000, 1500, 18, 24000, 'open', 1, NULL),
                (216, 41, 62000, 8000, 2250, 24, 58000, 'open', 1, NULL),
                (217, 47, 20500, 3500, 1417, 12, 11336, 'open', 1, NULL),
                (218, 52, 22500, 4500, 3000, 6, 9000, 'open', 1, NULL),
                (219, 58, 37500, 5500, 1778, 18, 28448, 'open', 1, NULL),
                (220, 4, 70000, 10000, 2500, 24, 67500, 'open', 1, NULL),
                (221, 10, 27000, 5000, 1833, 12, 18330, 'open', 1, NULL),
                (223, 22, 34500, 5500, 1611, 18, 30609, 'open', 1, NULL),
                (225, 33, 65000, 9000, 2333, 24, 62666, 'open', 1, NULL),
                (226, 38, 13500, 2500, 1833, 6, 9165, 'open', 1, NULL),
                (227, 44, 22500, 4500, 1500, 12, 18000, 'open', 1, NULL),
                (228, 50, 38000, 5500, 1806, 18, 36120, 'open', 1, NULL),
                (229, 56, 72000, 10000, 2583, 24, 72000, 'open', 1, NULL),
                (230, 2, 25900, 3900, 1833, 12, 20163, 'open', 1, NULL),
                (231, 7, 16500, 3000, 2250, 6, 13500, 'open', 1, NULL),
                (232, 13, 31000, 5000, 1444, 18, 28880, 'open', 1, NULL),
                (233, 19, 58000, 8000, 2083, 24, 58000, 'open', 1, NULL),
                (234, 25, 29500, 5000, 2042, 12, 26546, 'open', 1, NULL),
                (235, 31, 19500, 3500, 2667, 6, 16002, 'open', 1, NULL),
                (236, 37, 35000, 5500, 1639, 18, 34419, 'open', 1, NULL),
                (237, 43, 74000, 10000, 2667, 24, 74000, 'open', 1, NULL),
                (238, 49, 22500, 4500, 3000, 12, 18000, 'open', 1, NULL),
                (239, 55, 17500, 3500, 2333, 6, 14000, 'open', 1, NULL),

                -- Overdue accounts (missed payments)
                (193, 28, 69000, 9000, 2500, 24, 52500, 'open', 1, 'Missed 3 payments — follow up');
        ")?;

        // ── Payment Schedules for paid accounts ───────────────────────────────
        conn.execute_batch("
            -- Account 1 (sale 190, 6 months, paid) — schedules
            INSERT INTO payment_schedules (account_id, due_date, amount_due, status, amount_paid) VALUES
                (1, '2023-02-10', 2667, 'paid', 2667),
                (1, '2023-03-10', 2667, 'paid', 2667),
                (1, '2023-04-10', 2667, 'paid', 2667),
                (1, '2023-05-10', 2667, 'paid', 2667),
                (1, '2023-06-10', 2667, 'paid', 2667),
                (1, '2023-07-10', 2666, 'paid', 2666);

            -- Account 2 (sale 191, 12 months, paid) — schedules
            INSERT INTO payment_schedules (account_id, due_date, amount_due, status, amount_paid) VALUES
                (2, '2023-02-18', 2333, 'paid', 2333),
                (2, '2023-03-18', 2333, 'paid', 2333),
                (2, '2023-04-18', 2333, 'paid', 2333),
                (2, '2023-05-18', 2333, 'paid', 2333),
                (2, '2023-06-18', 2333, 'paid', 2333),
                (2, '2023-07-18', 2333, 'paid', 2333),
                (2, '2023-08-18', 2333, 'paid', 2333),
                (2, '2023-09-18', 2333, 'paid', 2333),
                (2, '2023-10-18', 2333, 'paid', 2333),
                (2, '2023-11-18', 2333, 'paid', 2333),
                (2, '2023-12-18', 2333, 'paid', 2333),
                (2, '2024-01-18', 2337, 'paid', 2337);

            -- Account 3 (sale 192, 6 months, paid)
            INSERT INTO payment_schedules (account_id, due_date, amount_due, status, amount_paid) VALUES
                (3, '2023-03-05', 3500, 'paid', 3500),
                (3, '2023-04-05', 3500, 'paid', 3500),
                (3, '2023-05-05', 3500, 'paid', 3500),
                (3, '2023-06-05', 3500, 'paid', 3500),
                (3, '2023-07-05', 3500, 'paid', 3500),
                (3, '2023-08-05', 3500, 'paid', 3500);

            -- Account 5 (sale 194, 12 months, paid)
            INSERT INTO payment_schedules (account_id, due_date, amount_due, status, amount_paid) VALUES
                (5, '2023-04-08', 1333, 'paid', 1333),
                (5, '2023-05-08', 1333, 'paid', 1333),
                (5, '2023-06-08', 1333, 'paid', 1333),
                (5, '2023-07-08', 1333, 'paid', 1333),
                (5, '2023-08-08', 1333, 'paid', 1333),
                (5, '2023-09-08', 1333, 'paid', 1333),
                (5, '2023-10-08', 1333, 'paid', 1333),
                (5, '2023-11-08', 1333, 'paid', 1333),
                (5, '2023-12-08', 1333, 'paid', 1333),
                (5, '2024-01-08', 1333, 'paid', 1333),
                (5, '2024-02-08', 1333, 'paid', 1333),
                (5, '2024-03-08', 1337, 'paid', 1337);
        ")?;

        // Payment schedules for active accounts
        conn.execute_batch("
            -- Account 16 (sale 193, 24 months, open - 9 payments made)
            INSERT INTO payment_schedules (account_id, due_date, amount_due, status, amount_paid) VALUES
                (16, '2023-03-28', 2500, 'paid', 2500),
                (16, '2023-04-28', 2500, 'paid', 2500),
                (16, '2023-05-28', 2500, 'paid', 2500),
                (16, '2023-06-28', 2500, 'paid', 2500),
                (16, '2023-07-28', 2500, 'paid', 2500),
                (16, '2023-08-28', 2500, 'paid', 2500),
                (16, '2023-09-28', 2500, 'paid', 2500),
                (16, '2023-10-28', 2500, 'paid', 2500),
                (16, '2023-11-28', 2500, 'paid', 2500),
                (16, '2023-12-28', 2500, 'pending', 0),
                (16, '2024-01-28', 2500, 'pending', 0),
                (16, '2024-02-28', 2500, 'pending', 0),
                (16, '2024-03-28', 2500, 'pending', 0),
                (16, '2024-04-28', 2500, 'pending', 0),
                (16, '2024-05-28', 2500, 'pending', 0),
                (16, '2024-06-28', 2500, 'pending', 0),
                (16, '2024-07-28', 2500, 'pending', 0),
                (16, '2024-08-28', 2500, 'pending', 0),
                (16, '2024-09-28', 2500, 'pending', 0),
                (16, '2024-10-28', 2500, 'pending', 0),
                (16, '2024-11-28', 2500, 'pending', 0),
                (16, '2024-12-28', 2500, 'pending', 0),
                (16, '2025-01-28', 2500, 'pending', 0);

            -- Account 17 (sale 195, 18 months, open - 11 paid, 7 pending)
            INSERT INTO payment_schedules (account_id, due_date, amount_due, status, amount_paid) VALUES
                (17, '2023-04-22', 1611, 'paid', 1611),
                (17, '2023-05-22', 1611, 'paid', 1611),
                (17, '2023-06-22', 1611, 'paid', 1611),
                (17, '2023-07-22', 1611, 'paid', 1611),
                (17, '2023-08-22', 1611, 'paid', 1611),
                (17, '2023-09-22', 1611, 'paid', 1611),
                (17, '2023-10-22', 1611, 'paid', 1611),
                (17, '2023-11-22', 1611, 'paid', 1611),
                (17, '2023-12-22', 1611, 'paid', 1611),
                (17, '2024-01-22', 1611, 'paid', 1611),
                (17, '2024-02-22', 1611, 'paid', 1611),
                (17, '2024-03-22', 1611, 'pending', 0),
                (17, '2024-04-22', 1611, 'pending', 0),
                (17, '2024-05-22', 1611, 'pending', 0),
                (17, '2024-06-22', 1611, 'pending', 0),
                (17, '2024-07-22', 1611, 'pending', 0),
                (17, '2024-08-22', 1611, 'pending', 0),
                (17, '2024-09-22', 1622, 'pending', 0);

            -- Account 20 (sale 202, 12 months, open - 7 paid, 5 pending)
            INSERT INTO payment_schedules (account_id, due_date, amount_due, status, amount_paid) VALUES
                (20, '2023-07-05', 1833, 'paid', 1833),
                (20, '2023-08-05', 1833, 'paid', 1833),
                (20, '2023-09-05', 1833, 'paid', 1833),
                (20, '2023-10-05', 1833, 'paid', 1833),
                (20, '2023-11-05', 1833, 'paid', 1833),
                (20, '2023-12-05', 1833, 'paid', 1833),
                (20, '2024-01-05', 1833, 'paid', 1833),
                (20, '2024-02-05', 1833, 'pending', 0),
                (20, '2024-03-05', 1833, 'pending', 0),
                (20, '2024-04-05', 1833, 'pending', 0),
                (20, '2024-05-05', 1833, 'pending', 0),
                (20, '2024-06-05', 1837, 'pending', 0);
        ")?;

        // ── Payments (actual payment records for paid accounts) ───────────────
        conn.execute_batch("
            -- Payments for account 1 (paid)
            INSERT INTO payments (account_id, payment_date, amount, type, notes) VALUES
                (1, '2023-02-09', 2667, 'payment', NULL),
                (1, '2023-03-10', 2667, 'payment', NULL),
                (1, '2023-04-10', 2667, 'payment', NULL),
                (1, '2023-05-10', 2667, 'payment', NULL),
                (1, '2023-06-11', 2667, 'payment', NULL),
                (1, '2023-07-09', 2666, 'payment', NULL);

            -- Payments for account 2 (paid)
            INSERT INTO payments (account_id, payment_date, amount, type, notes) VALUES
                (2, '2023-02-18', 2333, 'payment', NULL),
                (2, '2023-03-18', 2333, 'payment', NULL),
                (2, '2023-04-18', 2333, 'payment', NULL),
                (2, '2023-05-18', 2333, 'payment', NULL),
                (2, '2023-06-18', 2333, 'payment', NULL),
                (2, '2023-07-18', 2333, 'payment', NULL),
                (2, '2023-08-18', 2333, 'payment', NULL),
                (2, '2023-09-17', 2333, 'payment', NULL),
                (2, '2023-10-18', 2333, 'payment', NULL),
                (2, '2023-11-18', 2333, 'payment', NULL),
                (2, '2023-12-18', 2333, 'payment', NULL),
                (2, '2024-01-18', 2337, 'payment', NULL);

            -- Payments for account 3 (paid)
            INSERT INTO payments (account_id, payment_date, amount, type, notes) VALUES
                (3, '2023-03-05', 3500, 'payment', NULL),
                (3, '2023-04-05', 3500, 'payment', NULL),
                (3, '2023-05-05', 3500, 'payment', NULL),
                (3, '2023-06-05', 3500, 'payment', NULL),
                (3, '2023-07-05', 3500, 'payment', NULL),
                (3, '2023-08-04', 3500, 'payment', NULL);

            -- Payments for account 5 (paid)
            INSERT INTO payments (account_id, payment_date, amount, type, notes) VALUES
                (5, '2023-04-08', 1333, 'payment', NULL),
                (5, '2023-05-07', 1333, 'payment', NULL),
                (5, '2023-06-08', 1333, 'payment', NULL),
                (5, '2023-07-08', 1333, 'payment', NULL),
                (5, '2023-08-08', 1333, 'payment', NULL),
                (5, '2023-09-08', 1333, 'payment', NULL),
                (5, '2023-10-08', 1333, 'payment', NULL),
                (5, '2023-11-08', 1333, 'payment', NULL),
                (5, '2023-12-08', 1333, 'payment', NULL),
                (5, '2024-01-08', 1333, 'payment', NULL),
                (5, '2024-02-08', 1333, 'payment', NULL),
                (5, '2024-03-08', 1337, 'payment', NULL);

            -- Payments for account 16 (open — 9 payments)
            INSERT INTO payments (account_id, payment_date, amount, type, notes) VALUES
                (16, '2023-03-28', 2500, 'payment', NULL),
                (16, '2023-04-28', 2500, 'payment', NULL),
                (16, '2023-05-28', 2500, 'payment', NULL),
                (16, '2023-06-28', 2500, 'payment', NULL),
                (16, '2023-07-27', 2500, 'payment', NULL),
                (16, '2023-08-28', 2500, 'payment', NULL),
                (16, '2023-09-28', 2500, 'payment', NULL),
                (16, '2023-10-28', 2500, 'payment', NULL),
                (16, '2023-11-28', 2500, 'payment', NULL);

            -- Payments for account 17 (open — 11 payments)
            INSERT INTO payments (account_id, payment_date, amount, type, notes) VALUES
                (17, '2023-04-22', 1611, 'payment', NULL),
                (17, '2023-05-22', 1611, 'payment', NULL),
                (17, '2023-06-21', 1611, 'payment', NULL),
                (17, '2023-07-22', 1611, 'payment', NULL),
                (17, '2023-08-22', 1611, 'payment', NULL),
                (17, '2023-09-22', 1611, 'payment', NULL),
                (17, '2023-10-22', 1611, 'payment', NULL),
                (17, '2023-11-22', 1611, 'payment', NULL),
                (17, '2023-12-21', 1611, 'payment', NULL),
                (17, '2024-01-22', 1611, 'payment', NULL),
                (17, '2024-02-22', 1611, 'payment', NULL);

            -- Payments for account 20 (open — 7 payments)
            INSERT INTO payments (account_id, payment_date, amount, type, notes) VALUES
                (20, '2023-07-05', 1833, 'payment', NULL),
                (20, '2023-08-05', 1833, 'payment', NULL),
                (20, '2023-09-05', 1833, 'payment', NULL),
                (20, '2023-10-04', 1833, 'payment', NULL),
                (20, '2023-11-05', 1833, 'payment', NULL),
                (20, '2023-12-05', 1833, 'payment', NULL),
                (20, '2024-01-05', 1833, 'payment', NULL);
        ")?;
    }

    conn.execute_batch("INSERT INTO schema_migrations (version) VALUES (4);")?;
    println!("[db] Applied migration v4 — comprehensive demo seed data");
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
