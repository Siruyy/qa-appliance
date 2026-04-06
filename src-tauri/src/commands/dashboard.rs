use crate::db::connection::DbState;
use crate::models::report::{
    DailyCollection, DailySales, DashboardData, LowStockAlert, OverdueAccountAlert, RecentSale,
    UpcomingDue,
};
use crate::utils::date::{today_iso, days_ago_iso, first_of_month, prev_month_range};
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn get_dashboard_data(
    state: State<'_, DbState>,
    low_stock_threshold: Option<i64>,
    chart_days: Option<i64>,
) -> Result<DashboardData, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let today = today_iso();
    let month_start = first_of_month(&today);
    let (prev_start, prev_end) = prev_month_range(&today)?;
    let days = chart_days.unwrap_or(30).max(1) as u64;
    let chart_start = days_ago_iso(days);
    let threshold = low_stock_threshold.unwrap_or(5);

    // Sales KPIs — combine today, this-month, and last-month into one query
    let (today_sales_total, today_sales_count, month_sales_total, month_sales_count, last_month_sales_total): (f64, i64, f64, i64, f64) = db
        .query_row(
            "SELECT
               COALESCE(SUM(CASE WHEN DATE(sale_date) = ?1 THEN total ELSE 0 END), 0),
               COALESCE(SUM(CASE WHEN DATE(sale_date) = ?1 THEN 1 ELSE 0 END), 0),
               COALESCE(SUM(CASE WHEN DATE(sale_date) BETWEEN ?2 AND ?1 THEN total ELSE 0 END), 0),
               COALESCE(SUM(CASE WHEN DATE(sale_date) BETWEEN ?2 AND ?1 THEN 1 ELSE 0 END), 0),
               COALESCE(SUM(CASE WHEN DATE(sale_date) BETWEEN ?3 AND ?4 THEN total ELSE 0 END), 0)
             FROM sales WHERE status != 'voided'
               AND DATE(sale_date) >= ?3",
            params![today, month_start, prev_start, prev_end],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .map_err(|e| e.to_string())?;

    // Receivables
    let (total_receivables, open_accounts_count): (f64, i64) = db
        .query_row(
            "SELECT COALESCE(SUM(balance_remaining), 0), COUNT(*)
             FROM installment_accounts WHERE status = 'open'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    // Overdue
    let (overdue_total, overdue_accounts_count): (f64, i64) = db
        .query_row(
            "SELECT COALESCE(SUM(ia.balance_remaining), 0), COUNT(DISTINCT ia.id)
             FROM installment_accounts ia
             JOIN payment_schedules ps ON ps.account_id = ia.id
             WHERE ia.status = 'open'
               AND ps.status = 'pending'
               AND DATE(ps.due_date) < ?1",
            params![today],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    // Low stock
    let low_stock_count: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM product_variants
             WHERE is_active = 1 AND stock_qty > 0 AND stock_qty <= ?1",
            params![threshold],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Sales last 30 days
    let mut stmt = db
        .prepare(
            "SELECT DATE(sale_date) as d, SUM(total)
             FROM sales
             WHERE DATE(sale_date) >= ?1 AND status != 'voided'
             GROUP BY d ORDER BY d",
        )
        .map_err(|e| e.to_string())?;
    let sales_30 = stmt
        .query_map(params![chart_start], |row| {
            Ok(DailySales {
                date: row.get(0)?,
                total: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut sales_last_30_days = Vec::new();
    for r in sales_30 {
        sales_last_30_days.push(r.map_err(|e| e.to_string())?);
    }

    // Collections last 30 days
    let mut stmt2 = db
        .prepare(
            "SELECT DATE(payment_date) as d, SUM(amount)
             FROM payments
             WHERE DATE(payment_date) >= ?1
             GROUP BY d ORDER BY d",
        )
        .map_err(|e| e.to_string())?;
    let coll_30 = stmt2
        .query_map(params![chart_start], |row| {
            Ok(DailyCollection {
                date: row.get(0)?,
                total: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut collections_last_30_days = Vec::new();
    for r in coll_30 {
        collections_last_30_days.push(r.map_err(|e| e.to_string())?);
    }

    // Recent sales (last 10)
    let mut stmt3 = db
        .prepare(
            "SELECT s.id, s.sale_date,
                    COALESCE(c.name, 'Walk-in'), s.total, s.payment_type
             FROM sales s
             LEFT JOIN customers c ON c.id = s.customer_id
             WHERE s.status != 'voided'
             ORDER BY s.sale_date DESC, s.id DESC
             LIMIT 10",
        )
        .map_err(|e| e.to_string())?;
    let recent = stmt3
        .query_map([], |row| {
            Ok(RecentSale {
                id: row.get(0)?,
                sale_date: row.get(1)?,
                customer_name: row.get(2)?,
                total: row.get(3)?,
                payment_type: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut recent_sales = Vec::new();
    for r in recent {
        recent_sales.push(r.map_err(|e| e.to_string())?);
    }

    // Upcoming due (next 10 pending schedules)
    let mut stmt4 = db
        .prepare(
            "SELECT ia.id, c.name, ps.due_date, ps.amount_due,
                    GROUP_CONCAT(p.name, ', ')
             FROM payment_schedules ps
             JOIN installment_accounts ia ON ia.id = ps.account_id
             JOIN customers c ON c.id = ia.customer_id
             JOIN sales sa ON sa.id = ia.sale_id
             JOIN sale_items si ON si.sale_id = sa.id
             JOIN product_variants pv ON pv.id = si.variant_id
             JOIN products p ON p.id = pv.product_id
             WHERE ia.status = 'open' AND ps.status = 'pending'
             GROUP BY ps.id
             ORDER BY ps.due_date ASC
             LIMIT 10",
        )
        .map_err(|e| e.to_string())?;
    let upcoming = stmt4
        .query_map([], |row| {
            Ok(UpcomingDue {
                account_id: row.get(0)?,
                customer_name: row.get(1)?,
                due_date: row.get(2)?,
                amount_due: row.get(3)?,
                product_summary: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut upcoming_due = Vec::new();
    for r in upcoming {
        upcoming_due.push(r.map_err(|e| e.to_string())?);
    }

    // Named overdue accounts (top 5 by balance)
    let mut stmt5 = db
        .prepare(
            "SELECT ia.id, c.name,
                    ia.balance_remaining,
                    CAST(JULIANDAY('now') - JULIANDAY(MIN(ps.due_date)) AS INTEGER) as days_overdue,
                    COALESCE(GROUP_CONCAT(DISTINCT p.name), '') as product_summary
             FROM installment_accounts ia
             JOIN customers c ON c.id = ia.customer_id
             JOIN payment_schedules ps ON ps.account_id = ia.id
             LEFT JOIN sales sa ON sa.id = ia.sale_id
             LEFT JOIN sale_items si ON si.sale_id = sa.id
             LEFT JOIN product_variants pv ON pv.id = si.variant_id
             LEFT JOIN products p ON p.id = pv.product_id
             WHERE ia.status = 'open'
               AND ps.status = 'pending'
               AND DATE(ps.due_date) < ?1
             GROUP BY ia.id
             ORDER BY ia.balance_remaining DESC
             LIMIT 5",
        )
        .map_err(|e| e.to_string())?;
    let overdue_rows = stmt5
        .query_map(params![today], |row| {
            Ok(OverdueAccountAlert {
                id: row.get(0)?,
                customer_name: row.get(1)?,
                balance_remaining: row.get(2)?,
                days_overdue: row.get(3).unwrap_or(0),
                product_summary: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut overdue_accounts = Vec::new();
    for r in overdue_rows {
        overdue_accounts.push(r.map_err(|e| e.to_string())?);
    }

    // Named low stock variants (top 5 by scarcity — lowest qty relative to threshold)
    let mut stmt6 = db
        .prepare(
            "SELECT pv.id, p.name, COALESCE(pv.attributes, '{}'),
                    pv.stock_qty, pv.low_stock_threshold
             FROM product_variants pv
             JOIN products p ON p.id = pv.product_id
             WHERE pv.is_active = 1
               AND pv.stock_qty >= 0
               AND pv.stock_qty <= ?1
             ORDER BY pv.stock_qty ASC
             LIMIT 5",
        )
        .map_err(|e| e.to_string())?;
    let low_rows = stmt6
        .query_map(params![threshold], |row| {
            Ok(LowStockAlert {
                variant_id: row.get(0)?,
                product_name: row.get(1)?,
                attributes: row.get(2)?,
                stock_qty: row.get(3)?,
                low_stock_threshold: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut low_stock_items = Vec::new();
    for r in low_rows {
        low_stock_items.push(r.map_err(|e| e.to_string())?);
    }

    Ok(DashboardData {
        today_sales_total,
        today_sales_count,
        month_sales_total,
        month_sales_count,
        last_month_sales_total,
        total_receivables,
        open_accounts_count,
        overdue_accounts_count,
        overdue_total,
        low_stock_count,
        sales_last_30_days,
        collections_last_30_days,
        recent_sales,
        upcoming_due,
        overdue_accounts,
        low_stock_items,
    })
}
