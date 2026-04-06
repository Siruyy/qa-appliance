use std::collections::HashMap;

use rusqlite::params;
use tauri::State;

use crate::db::connection::DbState;
use crate::models::product::*;
use crate::utils::constants::DEFAULT_LOW_STOCK_THRESHOLD;
use crate::utils::validation::{require_text, optional_text};
use crate::models::PaginatedResult;

// ────────────────────────────────────────────
// Categories
// ────────────────────────────────────────────

#[tauri::command]
pub fn get_categories(db: State<'_, DbState>) -> Result<Vec<Category>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, created_at, updated_at FROM categories ORDER BY name")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut categories = Vec::new();
    for row in rows {
        categories.push(row.map_err(|e| e.to_string())?);
    }
    Ok(categories)
}

#[tauri::command]
pub fn create_category(db: State<'_, DbState>, name: String, description: Option<String>) -> Result<Category, String> {
    let name = require_text("Category name", &name, 200)?;
    let description = optional_text("Description", &description, 1000)?;

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO categories (name, description) VALUES (?1, ?2)",
        params![name, description],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, description, created_at, updated_at FROM categories WHERE id = ?1",
        params![id],
        |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_category(db: State<'_, DbState>, id: i64, name: String, description: Option<String>) -> Result<Category, String> {
    let name = require_text("Category name", &name, 200)?;
    let description = optional_text("Description", &description, 1000)?;

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE categories SET name = ?1, description = ?2, updated_at = datetime('now') WHERE id = ?3",
            params![name, description, id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Category not found".into());
    }

    conn.query_row(
        "SELECT id, name, description, created_at, updated_at FROM categories WHERE id = ?1",
        params![id],
        |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_category(db: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Check for linked products
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM products WHERE category_id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if count > 0 {
        return Err(format!("Cannot delete: {} product(s) use this category", count));
    }

    conn.execute("DELETE FROM categories WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ────────────────────────────────────────────
// Products
// ────────────────────────────────────────────

fn row_to_product(row: &rusqlite::Row) -> rusqlite::Result<Product> {
    Ok(Product {
        id: row.get("id")?,
        category_id: row.get("category_id")?,
        name: row.get("name")?,
        description: row.get("description")?,
        is_active: row.get::<_, i64>("is_active")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        category_name: row.get("category_name").ok(),
        variants: Vec::new(),
    })
}

fn row_to_variant(row: &rusqlite::Row) -> rusqlite::Result<ProductVariant> {
    let attr_str: Option<String> = row.get("attributes")?;
    let attributes = attr_str.and_then(|s| serde_json::from_str(&s).ok());

    Ok(ProductVariant {
        id: row.get("id")?,
        product_id: row.get("product_id")?,
        sku: row.get("sku")?,
        attributes,
        cost_price: row.get("cost_price")?,
        selling_price: row.get("selling_price")?,
        stock_qty: row.get("stock_qty")?,
        low_stock_threshold: row.get("low_stock_threshold")?,
        is_active: row.get::<_, i64>("is_active")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

#[tauri::command]
pub fn get_products(
    db: State<'_, DbState>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<PaginatedResult<Product>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let total: u64 = conn
        .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))
        .unwrap_or(0);

    let pagination = match limit {
        Some(l) => format!("LIMIT {} OFFSET {}", l, offset.unwrap_or(0)),
        None => String::new(),
    };

    let mut stmt = conn
        .prepare(&format!(
            "SELECT p.id, p.category_id, p.name, p.description, p.is_active,
                    p.created_at, p.updated_at, c.name AS category_name
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             ORDER BY p.name {}",
            pagination
        ))
        .map_err(|e| e.to_string())?;

    let mut products: Vec<Product> = stmt
        .query_map([], |row| row_to_product(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Fetch variants — only for this page's product IDs when paginated
    if !products.is_empty() {
        let variants: Vec<ProductVariant> = if limit.is_some() {
            let product_ids: Vec<i64> = products.iter().map(|p| p.id).collect();
            let placeholders: String = product_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
            let mut v_stmt = conn
                .prepare(&format!(
                    "SELECT id, product_id, sku, attributes, cost_price, selling_price,
                            stock_qty, low_stock_threshold, is_active, created_at, updated_at
                     FROM product_variants
                     WHERE product_id IN ({})
                     ORDER BY product_id, id",
                    placeholders
                ))
                .map_err(|e| e.to_string())?;
            let result = v_stmt
                .query_map(rusqlite::params_from_iter(product_ids.iter()), |row| row_to_variant(row))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            result
        } else {
            let mut v_stmt = conn
                .prepare(
                    "SELECT id, product_id, sku, attributes, cost_price, selling_price,
                            stock_qty, low_stock_threshold, is_active, created_at, updated_at
                     FROM product_variants
                     ORDER BY product_id, id",
                )
                .map_err(|e| e.to_string())?;
            let result = v_stmt
                .query_map([], |row| row_to_variant(row))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            result
        };

        // Group variants by product_id in O(N) using a HashMap
        let mut variant_map: HashMap<i64, Vec<ProductVariant>> = HashMap::new();
        for v in variants {
            variant_map.entry(v.product_id).or_default().push(v);
        }
        for product in &mut products {
            if let Some(pvs) = variant_map.remove(&product.id) {
                product.variants = pvs;
            }
        }
    }

    Ok(PaginatedResult { items: products, total })
}

#[tauri::command]
pub fn get_product_by_id(db: State<'_, DbState>, id: i64) -> Result<Product, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut product = conn
        .query_row(
            "SELECT p.id, p.category_id, p.name, p.description, p.is_active,
                    p.created_at, p.updated_at, c.name AS category_name
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.id = ?1",
            params![id],
            |row| row_to_product(row),
        )
        .map_err(|e| e.to_string())?;

    let mut v_stmt = conn
        .prepare(
            "SELECT id, product_id, sku, attributes, cost_price, selling_price,
                    stock_qty, low_stock_threshold, is_active, created_at, updated_at
             FROM product_variants WHERE product_id = ?1
             ORDER BY id",
        )
        .map_err(|e| e.to_string())?;

    product.variants = v_stmt
        .query_map(params![id], |row| row_to_variant(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(product)
}

#[tauri::command]
pub fn create_product(db: State<'_, DbState>, payload: CreateProductPayload) -> Result<Product, String> {
    let name = require_text("Product name", &payload.name, 300)?;
    let description = optional_text("Description", &payload.description, 2000)?;

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO products (category_id, name, description) VALUES (?1, ?2, ?3)",
        params![payload.category_id, name, description],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    drop(conn);
    get_product_by_id_inner(&db, id)
}

#[tauri::command]
pub fn update_product(db: State<'_, DbState>, payload: UpdateProductPayload) -> Result<Product, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref name) = payload.name {
        let name = require_text("Product name", name, 300)?;
        sets.push("name = ?".into());
        values.push(Box::new(name));
    }
    if let Some(ref desc) = payload.description {
        let desc = optional_text("Description", &Some(desc.clone()), 2000)?.unwrap_or_default();
        sets.push("description = ?".into());
        values.push(Box::new(desc));
    }
    if let Some(cat_id) = payload.category_id {
        sets.push("category_id = ?".into());
        values.push(Box::new(cat_id));
    }

    if sets.is_empty() {
        return Err("No fields to update".into());
    }

    sets.push("updated_at = datetime('now')".into());
    values.push(Box::new(payload.id));

    let sql = format!(
        "UPDATE products SET {} WHERE id = ?",
        sets.join(", ")
    );

    let affected = conn
        .execute(&sql, rusqlite::params_from_iter(values.iter().map(|v| v.as_ref())))
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Product not found".into());
    }

    drop(conn);
    get_product_by_id_inner(&db, payload.id)
}

#[tauri::command]
pub fn archive_product(db: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    // Also archive all variants
    conn.execute(
        "UPDATE product_variants SET is_active = 0, updated_at = datetime('now') WHERE product_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn restore_product(db: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE products SET is_active = 1, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    // Restore all variants
    conn.execute(
        "UPDATE product_variants SET is_active = 1, updated_at = datetime('now') WHERE product_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ────────────────────────────────────────────
// Product Variants
// ────────────────────────────────────────────

#[tauri::command]
pub fn get_variants_for_product(db: State<'_, DbState>, product_id: i64) -> Result<Vec<ProductVariant>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, product_id, sku, attributes, cost_price, selling_price,
                    stock_qty, low_stock_threshold, is_active, created_at, updated_at
             FROM product_variants WHERE product_id = ?1
             ORDER BY id",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_map(params![product_id], |row| row_to_variant(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string());

    result
}

#[tauri::command]
pub fn create_variant(db: State<'_, DbState>, payload: CreateVariantPayload) -> Result<ProductVariant, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let attr_json = payload.attributes.map(|a| serde_json::to_string(&a).unwrap_or_default());
    let threshold = payload.low_stock_threshold.unwrap_or(DEFAULT_LOW_STOCK_THRESHOLD);

    conn.execute(
        "INSERT INTO product_variants (product_id, sku, attributes, cost_price, selling_price, stock_qty, low_stock_threshold)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            payload.product_id,
            payload.sku,
            attr_json,
            payload.cost_price,
            payload.selling_price,
            payload.stock_qty,
            threshold
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    let _ = conn.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        params!["create", "variant", id, format!("Created variant SKU={}", payload.sku.as_deref().unwrap_or("N/A"))],
    );

    conn.query_row(
        "SELECT id, product_id, sku, attributes, cost_price, selling_price,
                stock_qty, low_stock_threshold, is_active, created_at, updated_at
         FROM product_variants WHERE id = ?1",
        params![id],
        |row| row_to_variant(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_variant(db: State<'_, DbState>, payload: UpdateVariantPayload) -> Result<ProductVariant, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref sku) = payload.sku {
        sets.push("sku = ?".into());
        values.push(Box::new(sku.clone()));
    }
    if let Some(ref attr) = payload.attributes {
        sets.push("attributes = ?".into());
        values.push(Box::new(serde_json::to_string(attr).unwrap_or_default()));
    }
    if let Some(cost) = payload.cost_price {
        sets.push("cost_price = ?".into());
        values.push(Box::new(cost));
    }
    if let Some(sell) = payload.selling_price {
        sets.push("selling_price = ?".into());
        values.push(Box::new(sell));
    }
    if let Some(qty) = payload.stock_qty {
        sets.push("stock_qty = ?".into());
        values.push(Box::new(qty));
    }
    if let Some(thresh) = payload.low_stock_threshold {
        sets.push("low_stock_threshold = ?".into());
        values.push(Box::new(thresh));
    }

    if sets.is_empty() {
        return Err("No fields to update".into());
    }

    sets.push("updated_at = datetime('now')".into());
    values.push(Box::new(payload.id));

    let sql = format!(
        "UPDATE product_variants SET {} WHERE id = ?",
        sets.join(", ")
    );

    let affected = conn
        .execute(&sql, rusqlite::params_from_iter(values.iter().map(|v| v.as_ref())))
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Variant not found".into());
    }

    let _ = conn.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        params!["update", "variant", payload.id, format!("Updated variant #{}", payload.id)],
    );

    conn.query_row(
        "SELECT id, product_id, sku, attributes, cost_price, selling_price,
                stock_qty, low_stock_threshold, is_active, created_at, updated_at
         FROM product_variants WHERE id = ?1",
        params![payload.id],
        |row| row_to_variant(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn archive_variant(db: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE product_variants SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    let _ = conn.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        params!["archive", "variant", id, format!("Archived variant #{}", id)],
    );

    Ok(())
}

#[tauri::command]
pub fn adjust_stock(db: State<'_, DbState>, id: i64, delta: i64) -> Result<ProductVariant, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Ensure new quantity won't go negative
    let current_qty: i64 = conn
        .query_row(
            "SELECT stock_qty FROM product_variants WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let new_qty = current_qty + delta;
    if new_qty < 0 {
        return Err(format!(
            "Stock cannot go below 0 (current: {}, adjustment: {})",
            current_qty, delta
        ));
    }

    conn.execute(
        "UPDATE product_variants SET stock_qty = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_qty, id],
    )
    .map_err(|e| e.to_string())?;

    let _ = conn.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        params!["stock_adjust", "variant", id, format!("Stock adjusted by {} ({}→{})", delta, current_qty, new_qty)],
    );

    let _ = conn.execute(
        "INSERT INTO stock_movements (variant_id, delta, reason, notes) VALUES (?1, ?2, ?3, ?4)",
        params![id, delta, "adjustment", format!("Manual adjustment: {} → {}", current_qty, new_qty)],
    );

    conn.query_row(
        "SELECT id, product_id, sku, attributes, cost_price, selling_price,
                stock_qty, low_stock_threshold, is_active, created_at, updated_at
         FROM product_variants WHERE id = ?1",
        params![id],
        |row| row_to_variant(row),
    )
    .map_err(|e| e.to_string())
}

// ────────────────────────────────────────────
// Internal helpers (non-command)
// ────────────────────────────────────────────

fn get_product_by_id_inner(db: &State<'_, DbState>, id: i64) -> Result<Product, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut product = conn
        .query_row(
            "SELECT p.id, p.category_id, p.name, p.description, p.is_active,
                    p.created_at, p.updated_at, c.name AS category_name
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.id = ?1",
            params![id],
            |row| row_to_product(row),
        )
        .map_err(|e| e.to_string())?;

    let mut v_stmt = conn
        .prepare(
            "SELECT id, product_id, sku, attributes, cost_price, selling_price,
                    stock_qty, low_stock_threshold, is_active, created_at, updated_at
             FROM product_variants WHERE product_id = ?1 ORDER BY id",
        )
        .map_err(|e| e.to_string())?;

    product.variants = v_stmt
        .query_map(params![id], |row| row_to_variant(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(product)
}
