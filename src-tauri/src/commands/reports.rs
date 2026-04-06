use tauri::State;
use crate::db::connection::DbState;
use crate::models::report::*;
use crate::utils::date::{today_iso, days_since};
use std::collections::HashMap;

// ──────────────────────────────────────────────────────────
// Report 1: Sales Summary
// ──────────────────────────────────────────────────────────
#[tauri::command]
pub fn get_sales_summary(
    state: State<DbState>,
    from_date: String,
    to_date: String,
) -> Result<SalesSummaryReport, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // Detail rows
    let mut stmt = db.prepare(
        "SELECT s.id, s.sale_date, COALESCE(c.name, 'Walk-in') as customer_name,
                COALESCE(GROUP_CONCAT(DISTINCT p.name || ' (×' || si.quantity || ')'), '') as items_summary,
                s.total, s.payment_type, s.status
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants pv ON pv.id = si.variant_id
         LEFT JOIN products p ON p.id = pv.product_id
         WHERE DATE(s.sale_date) BETWEEN ?1 AND ?2
           AND s.status = 'completed'
         GROUP BY s.id
         ORDER BY s.sale_date DESC"
    ).map_err(|e| e.to_string())?;

    let sales: Vec<SalesSummaryRow> = stmt.query_map(
        rusqlite::params![from_date, to_date],
        |row| {
            Ok(SalesSummaryRow {
                id: row.get(0)?,
                sale_date: row.get(1)?,
                customer_name: row.get(2)?,
                items_summary: row.get(3)?,
                total: row.get(4)?,
                payment_type: row.get(5)?,
                status: row.get(6)?,
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    // KPIs
    let total_sales: f64 = sales.iter().map(|s| s.total).sum();
    let transaction_count = sales.len() as i64;
    let cash_total: f64 = sales.iter().filter(|s| s.payment_type == "cash").map(|s| s.total).sum();
    let installment_total: f64 = total_sales - cash_total;

    // Daily totals
    let mut daily_map: HashMap<String, f64> = HashMap::new();
    for s in &sales {
        let date = s.sale_date.split('T').next().unwrap_or(&s.sale_date).to_string();
        *daily_map.entry(date).or_insert(0.0) += s.total;
    }
    let mut daily_totals: Vec<DailyTotal> = daily_map.into_iter()
        .map(|(date, total)| DailyTotal { date, total })
        .collect();
    daily_totals.sort_by(|a, b| a.date.cmp(&b.date));

    // Voided sales summary
    let (voided_count, voided_total): (i64, f64) = db.query_row(
        "SELECT COUNT(*), COALESCE(SUM(total), 0) FROM sales WHERE DATE(sale_date) BETWEEN ?1 AND ?2 AND status = 'voided'",
        rusqlite::params![from_date, to_date],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).unwrap_or((0, 0.0));

    // Discount total
    let discount_total: f64 = db.query_row(
        "SELECT COALESCE(SUM(discount), 0) FROM sales WHERE DATE(sale_date) BETWEEN ?1 AND ?2 AND status = 'completed'",
        rusqlite::params![from_date, to_date],
        |row| row.get(0),
    ).unwrap_or(0.0);

    Ok(SalesSummaryReport {
        total_sales,
        transaction_count,
        cash_total,
        installment_total,
        voided_count,
        voided_total,
        discount_total,
        daily_totals,
        sales,
    })
}

// ──────────────────────────────────────────────────────────
// Report 2: Receivables
// ──────────────────────────────────────────────────────────
#[tauri::command]
pub fn get_receivables_report(
    state: State<DbState>,
    status_filter: Option<String>,
) -> Result<ReceivablesReport, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let mut sql = String::from(
        "SELECT ia.id, c.name as customer_name,
                COALESCE(GROUP_CONCAT(DISTINCT p.name), '') as product_summary,
                ia.balance_remaining, ia.has_schedule, ia.status,
                (SELECT CAST(JULIANDAY('now') - JULIANDAY(MIN(ps.due_date)) AS INTEGER)
                 FROM payment_schedules ps
                 WHERE ps.account_id = ia.id AND ps.status = 'overdue') as days_overdue
         FROM installment_accounts ia
         JOIN customers c ON c.id = ia.customer_id
         LEFT JOIN sales s ON s.id = ia.sale_id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants pv ON pv.id = si.variant_id
         LEFT JOIN products p ON p.id = pv.product_id
         WHERE 1=1"
    );

    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref status) = status_filter {
        if status == "overdue" {
            sql.push_str(" AND ia.status = 'open' AND EXISTS (SELECT 1 FROM payment_schedules ps2 WHERE ps2.account_id = ia.id AND ps2.status = 'overdue')");
        } else if status != "all" {
            sql.push_str(&format!(" AND ia.status = ?{}", params.len() + 1));
            params.push(Box::new(status.clone()));
        }
    } else {
        sql.push_str(" AND ia.status IN ('open')");
    }

    sql.push_str(" GROUP BY ia.id ORDER BY ia.balance_remaining DESC");

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
    let accounts: Vec<ReceivablesRow> = stmt.query_map(
        param_refs.as_slice(),
        |row| {
            Ok(ReceivablesRow {
                id: row.get(0)?,
                customer_name: row.get(1)?,
                product_summary: row.get(2)?,
                balance_remaining: row.get(3)?,
                has_schedule: row.get(4)?,
                status: row.get(5)?,
                days_overdue: row.get(6)?,
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let total_outstanding: f64 = accounts.iter().map(|a| a.balance_remaining).sum();
    let overdue_total: f64 = accounts.iter()
        .filter(|a| a.days_overdue.is_some() && a.days_overdue.unwrap() > 0)
        .map(|a| a.balance_remaining).sum();
    let overdue_pct = if total_outstanding > 0.0 { (overdue_total / total_outstanding) * 100.0 } else { 0.0 };
    let open_count = accounts.len() as i64;

    let current_total = total_outstanding - overdue_total;
    let status_breakdown = vec![
        StatusBreakdown { label: "Overdue".to_string(), value: overdue_total },
        StatusBreakdown { label: "Current".to_string(), value: current_total },
    ];

    Ok(ReceivablesReport {
        total_outstanding,
        overdue_total,
        overdue_pct,
        open_count,
        status_breakdown,
        accounts,
    })
}

// ──────────────────────────────────────────────────────────
// Report 3: Inventory Valuation
// ──────────────────────────────────────────────────────────
#[tauri::command]
pub fn get_inventory_valuation_report(
    state: State<DbState>,
    category_id: Option<i64>,
) -> Result<InventoryReport, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let mut sql = String::from(
        "SELECT p.name as product_name,
                COALESCE(pv.attributes, 'Default') as variant_name,
                COALESCE(pv.sku, '') as sku,
                pv.stock_qty, pv.cost_price, pv.selling_price,
                (pv.stock_qty * pv.cost_price) as cost_value,
                (pv.stock_qty * pv.selling_price) as retail_value,
                CASE
                  WHEN pv.stock_qty = 0 THEN 'Out of Stock'
                  WHEN pv.stock_qty <= pv.low_stock_threshold THEN 'Low Stock'
                  ELSE 'In Stock'
                END as status
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE p.is_active = 1 AND pv.is_active = 1"
    );

    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    if let Some(cid) = category_id {
        sql.push_str(&format!(" AND p.category_id = ?{}", params.len() + 1));
        params.push(Box::new(cid));
    }

    sql.push_str(" ORDER BY p.name, pv.attributes");

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
    let items: Vec<InventoryRow> = stmt.query_map(
        param_refs.as_slice(),
        |row| {
            Ok(InventoryRow {
                product_name: row.get(0)?,
                variant_name: row.get(1)?,
                sku: row.get(2)?,
                stock_quantity: row.get(3)?,
                cost_price: row.get(4)?,
                selling_price: row.get(5)?,
                cost_value: row.get(6)?,
                retail_value: row.get(7)?,
                status: row.get(8)?,
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let total_retail_value: f64 = items.iter().map(|i| i.retail_value).sum();
    let total_cost_value: f64 = items.iter().map(|i| i.cost_value).sum();
    let gross_margin_pct = if total_retail_value > 0.0 {
        ((total_retail_value - total_cost_value) / total_retail_value) * 100.0
    } else { 0.0 };
    let items_in_stock = items.iter().filter(|i| i.stock_quantity > 0).count() as i64;
    let low_stock_count = items.iter().filter(|i| i.status == "Low Stock").count() as i64;
    let out_of_stock_count = items.iter().filter(|i| i.status == "Out of Stock").count() as i64;

    // By category
    let mut cat_stmt = db.prepare(
        "SELECT COALESCE(cat.name, 'Uncategorized') as category,
                SUM(pv.stock_qty) as total_stock,
                SUM(pv.stock_qty * pv.cost_price) as total_cost_value
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         LEFT JOIN categories cat ON cat.id = p.category_id
         WHERE p.is_active = 1 AND pv.is_active = 1
         GROUP BY cat.id
         ORDER BY total_cost_value DESC"
    ).map_err(|e| e.to_string())?;

    let by_category: Vec<CategoryStock> = cat_stmt.query_map(
        rusqlite::params![],
        |row| {
            Ok(CategoryStock {
                category: row.get(0)?,
                total_stock: row.get(1)?,
                total_cost_value: row.get(2)?,
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    Ok(InventoryReport {
        total_retail_value,
        total_cost_value,
        gross_margin_pct,
        items_in_stock,
        low_stock_count,
        out_of_stock_count,
        by_category,
        items,
    })
}

// ──────────────────────────────────────────────────────────
// Report 4: Collections
// ──────────────────────────────────────────────────────────
#[tauri::command]
pub fn get_collections_report(
    state: State<DbState>,
    from_date: String,
    to_date: String,
    customer_id: Option<i64>,
) -> Result<CollectionsReport, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let mut sql = String::from(
        "SELECT pay.id, pay.payment_date,
                COALESCE(c.name, 'Unknown') as customer_name,
                COALESCE(GROUP_CONCAT(DISTINCT p.name), '') as product_summary,
                pay.amount, pay.type
         FROM payments pay
         JOIN installment_accounts ia ON ia.id = pay.account_id
         JOIN customers c ON c.id = ia.customer_id
         LEFT JOIN sales s ON s.id = ia.sale_id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants pv ON pv.id = si.variant_id
         LEFT JOIN products p ON p.id = pv.product_id
         WHERE DATE(pay.payment_date) BETWEEN ?1 AND ?2"
    );

    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    params.push(Box::new(from_date));
    params.push(Box::new(to_date));

    if let Some(cid) = customer_id {
        sql.push_str(&format!(" AND ia.customer_id = ?{}", params.len() + 1));
        params.push(Box::new(cid));
    }

    sql.push_str(" GROUP BY pay.id ORDER BY pay.payment_date DESC");

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
    let payments: Vec<CollectionsRow> = stmt.query_map(
        param_refs.as_slice(),
        |row| {
            Ok(CollectionsRow {
                id: row.get(0)?,
                payment_date: row.get(1)?,
                customer_name: row.get(2)?,
                product_summary: row.get(3)?,
                amount: row.get(4)?,
                payment_type: row.get(5)?,
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let total_collected: f64 = payments.iter().map(|p| p.amount).sum();
    let transaction_count = payments.len() as i64;
    let cash_payments: f64 = payments.iter()
        .filter(|p| p.payment_type == "payment" || p.payment_type == "down_payment")
        .map(|p| p.amount).sum();
    let penalty_total: f64 = payments.iter()
        .filter(|p| p.payment_type == "penalty")
        .map(|p| p.amount).sum();
    let rebate_total: f64 = payments.iter()
        .filter(|p| p.payment_type == "rebate")
        .map(|p| p.amount.abs())
        .sum();

    let mut daily_map: HashMap<String, f64> = HashMap::new();
    for p in &payments {
        let date = p.payment_date.split('T').next().unwrap_or(&p.payment_date).to_string();
        *daily_map.entry(date).or_insert(0.0) += p.amount;
    }
    let mut daily_totals: Vec<DailyTotal> = daily_map.into_iter()
        .map(|(date, total)| DailyTotal { date, total })
        .collect();
    daily_totals.sort_by(|a, b| a.date.cmp(&b.date));

    Ok(CollectionsReport {
        total_collected,
        transaction_count,
        cash_payments,
        penalty_total,
        rebate_total,
        daily_totals,
        payments,
    })
}

// ──────────────────────────────────────────────────────────
// Report 5: Customer History
// ──────────────────────────────────────────────────────────
#[tauri::command]
pub fn get_customer_history_report(
    state: State<DbState>,
    customer_id: i64,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<CustomerHistoryReport, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // Customer info
    let (customer_name, phone, address): (String, Option<String>, Option<String>) = db.query_row(
        "SELECT name, phone, address FROM customers WHERE id = ?1",
        rusqlite::params![customer_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    ).map_err(|e| format!("Customer not found: {}", e))?;

    // Sales
    let mut sales_sql = String::from(
        "SELECT s.id, s.sale_date,
                COALESCE(GROUP_CONCAT(p.name || ' (×' || si.quantity || ')', ', '), '') as items_summary,
                s.total, s.payment_type
         FROM sales s
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants pv ON pv.id = si.variant_id
         LEFT JOIN products p ON p.id = pv.product_id
         WHERE s.customer_id = ?1 AND s.status = 'completed'"
    );

    let mut sales_params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    sales_params.push(Box::new(customer_id));

    if let Some(ref fd) = from_date {
        sales_sql.push_str(&format!(" AND DATE(s.sale_date) >= ?{}", sales_params.len() + 1));
        sales_params.push(Box::new(fd.clone()));
    }
    if let Some(ref td) = to_date {
        sales_sql.push_str(&format!(" AND DATE(s.sale_date) <= ?{}", sales_params.len() + 1));
        sales_params.push(Box::new(td.clone()));
    }

    sales_sql.push_str(" GROUP BY s.id ORDER BY s.sale_date DESC");

    let sp_refs: Vec<&dyn rusqlite::types::ToSql> = sales_params.iter().map(|p| p.as_ref()).collect();
    let mut sales_stmt = db.prepare(&sales_sql).map_err(|e| e.to_string())?;
    let sales: Vec<CustomerSaleRow> = sales_stmt.query_map(
        sp_refs.as_slice(),
        |row| {
            Ok(CustomerSaleRow {
                id: row.get(0)?,
                sale_date: row.get(1)?,
                items_summary: row.get(2)?,
                total: row.get(3)?,
                payment_type: row.get(4)?,
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    // Payments
    let mut pay_sql = String::from(
        "SELECT pay.id, pay.payment_date, pay.amount, pay.type,
                COALESCE(GROUP_CONCAT(DISTINCT p.name), '') as product_summary
         FROM payments pay
         JOIN installment_accounts ia ON ia.id = pay.account_id
         LEFT JOIN sales s ON s.id = ia.sale_id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants pv ON pv.id = si.variant_id
         LEFT JOIN products p ON p.id = pv.product_id
         WHERE ia.customer_id = ?1"
    );

    let mut pay_params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    pay_params.push(Box::new(customer_id));

    if let Some(ref fd) = from_date {
        pay_sql.push_str(&format!(" AND DATE(pay.payment_date) >= ?{}", pay_params.len() + 1));
        pay_params.push(Box::new(fd.clone()));
    }
    if let Some(ref td) = to_date {
        pay_sql.push_str(&format!(" AND DATE(pay.payment_date) <= ?{}", pay_params.len() + 1));
        pay_params.push(Box::new(td.clone()));
    }

    pay_sql.push_str(" GROUP BY pay.id ORDER BY pay.payment_date DESC");

    let pp_refs: Vec<&dyn rusqlite::types::ToSql> = pay_params.iter().map(|p| p.as_ref()).collect();
    let mut pay_stmt = db.prepare(&pay_sql).map_err(|e| e.to_string())?;
    let payments: Vec<CustomerPaymentRow> = pay_stmt.query_map(
        pp_refs.as_slice(),
        |row| {
            Ok(CustomerPaymentRow {
                id: row.get(0)?,
                payment_date: row.get(1)?,
                amount: row.get(2)?,
                payment_type: row.get(3)?,
                product_summary: row.get(4)?,
            })
        }
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    // KPIs
    let total_purchased: f64 = sales.iter().map(|s| s.total).sum();
    let total_paid: f64 = payments.iter()
        .filter(|p| p.payment_type != "penalty")
        .map(|p| p.amount).sum();

    // Balance from accounts
    let total_balance: f64 = db.query_row(
        "SELECT COALESCE(SUM(balance_remaining), 0) FROM installment_accounts WHERE customer_id = ?1 AND status = 'open'",
        rusqlite::params![customer_id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;

    Ok(CustomerHistoryReport {
        customer_name,
        phone,
        address,
        total_purchased,
        total_paid,
        total_balance,
        sales,
        payments,
    })
}

// ──────────────────────────────────────────────────────────
// Report 6: Profit & Loss
// ──────────────────────────────────────────────────────────
#[tauri::command]
pub fn get_profit_loss_report(
    state: State<DbState>,
    from_date: String,
    to_date: String,
) -> Result<ProfitLossReport, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // Revenue and COGS per category
    // Revenue uses si.subtotal (post-item-discount) and we distribute the
    // sale-level discount proportionally across items for accurate category breakdown.
    let mut stmt = db.prepare(
        "SELECT COALESCE(cat.name, 'Uncategorized') as category,
                SUM(si.subtotal) as item_revenue,
                SUM(si.quantity * si.cost_price_snapshot) as cogs,
                SUM(
                  CASE WHEN s.discount > 0 AND sale_totals.sale_subtotal > 0
                    THEN si.subtotal * s.discount / sale_totals.sale_subtotal
                    ELSE 0
                  END
                ) as allocated_discount
         FROM sales s
         JOIN sale_items si ON si.sale_id = s.id
         JOIN product_variants pv ON pv.id = si.variant_id
         JOIN products p ON p.id = pv.product_id
         LEFT JOIN categories cat ON cat.id = p.category_id
         LEFT JOIN (
           SELECT sale_id, SUM(subtotal) as sale_subtotal
           FROM sale_items GROUP BY sale_id
         ) sale_totals ON sale_totals.sale_id = s.id
         WHERE DATE(s.sale_date) BETWEEN ?1 AND ?2
           AND s.status = 'completed'
         GROUP BY cat.id
         ORDER BY item_revenue DESC"
    ).map_err(|e| e.to_string())?;

    let rows: Vec<(String, f64, f64, f64)> = stmt.query_map(
        rusqlite::params![from_date, to_date],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    ).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let revenue: f64 = rows.iter().map(|r| r.1 - r.3).sum(); // item revenue minus allocated discount
    let cogs: f64 = rows.iter().map(|r| r.2).sum();
    let gross_profit = revenue - cogs;
    let gross_margin_pct = if revenue > 0.0 { (gross_profit / revenue) * 100.0 } else { 0.0 };

    let by_category: Vec<CategoryRevenue> = rows.iter().map(|(cat, rev, cost, disc)| {
        let net_rev = rev - disc;
        CategoryRevenue {
            category: cat.clone(),
            revenue: net_rev,
            cogs: *cost,
            pct: if revenue > 0.0 { (net_rev / revenue) * 100.0 } else { 0.0 },
        }
    }).collect();

    Ok(ProfitLossReport {
        revenue,
        cogs,
        gross_profit,
        gross_margin_pct,
        by_category,
    })
}

#[tauri::command]
pub fn get_aging_report(state: State<DbState>) -> Result<AgingReport, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // For each open account, compute days overdue based on earliest unpaid schedule
    let sql = "
        SELECT
            c.id AS customer_id,
            c.name AS customer_name,
            ia.balance_remaining,
            COALESCE(
                (SELECT MIN(ps.due_date) FROM payment_schedules ps
                 WHERE ps.account_id = ia.id AND ps.status IN ('pending', 'overdue')),
                ia.start_date
            ) AS earliest_due
        FROM installment_accounts ia
        JOIN sales s ON s.id = ia.sale_id
        JOIN customers c ON c.id = s.customer_id
        WHERE ia.status = 'open' AND ia.balance_remaining > 0.01
        ORDER BY c.name
    ";

    let mut stmt = db.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, Option<String>>(3)?,
        ))
    }).map_err(|e| e.to_string())?;

    let today = today_iso();

    // Aggregate by customer
    let mut customer_map: std::collections::HashMap<i64, AgingBucket> = std::collections::HashMap::new();

    for row in rows {
        let (cid, cname, balance, earliest_due_opt) = row.map_err(|e| e.to_string())?;

        let earliest_due = earliest_due_opt.unwrap_or_else(|| today.clone());

        let days_overdue = if earliest_due <= today {
            days_since(&earliest_due, &today)
        } else {
            0
        };

        let entry = customer_map.entry(cid).or_insert_with(|| AgingBucket {
            customer_id: cid,
            customer_name: cname,
            current: 0.0,
            days_1_30: 0.0,
            days_31_60: 0.0,
            days_61_90: 0.0,
            days_over_90: 0.0,
            total: 0.0,
        });

        match days_overdue {
            d if d <= 0 => entry.current += balance,
            1..=30 => entry.days_1_30 += balance,
            31..=60 => entry.days_31_60 += balance,
            61..=90 => entry.days_61_90 += balance,
            _ => entry.days_over_90 += balance,
        }
        entry.total += balance;
    }

    let buckets: Vec<AgingBucket> = customer_map.into_values().collect();

    let total_current = buckets.iter().map(|b| b.current).sum();
    let total_1_30 = buckets.iter().map(|b| b.days_1_30).sum();
    let total_31_60 = buckets.iter().map(|b| b.days_31_60).sum();
    let total_61_90 = buckets.iter().map(|b| b.days_61_90).sum();
    let total_over_90 = buckets.iter().map(|b| b.days_over_90).sum();
    let grand_total = buckets.iter().map(|b| b.total).sum();

    Ok(AgingReport {
        buckets,
        total_current,
        total_1_30,
        total_31_60,
        total_61_90,
        total_over_90,
        grand_total,
    })
}
