use crate::db::connection::DbState;
use crate::models::report::{
    DailyCollection, DailySales, DashboardData, RecentSale, UpcomingDue,
};
use rusqlite::params;
use tauri::State;

/// Get current date as "YYYY-MM-DD" without chrono (UTC).
fn today_utc() -> String {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    let days = (dur.as_secs() / 86400) as i64;
    civil_from_days(days)
}

fn civil_from_days(day_count: i64) -> String {
    let z = day_count + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y_final = if m <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}", y_final, m, d)
}

fn first_of_month(date: &str) -> String {
    format!("{}-01", &date[..7])
}

fn days_ago(n: u64) -> String {
    let dur = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap();
    let days = (dur.as_secs() / 86400) as i64 - n as i64;
    civil_from_days(days)
}

/// Return first day of previous month from a YYYY-MM-DD
fn prev_month_range(today: &str) -> (String, String) {
    let y: i32 = today[..4].parse().unwrap();
    let m: u32 = today[5..7].parse().unwrap();
    let (py, pm) = if m == 1 { (y - 1, 12) } else { (y, m - 1) };
    let first = format!("{:04}-{:02}-01", py, pm);
    let last_day = days_in_month(py, pm);
    let last = format!("{:04}-{:02}-{:02}", py, pm, last_day);
    (first, last)
}

fn days_in_month(y: i32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 {
                29
            } else {
                28
            }
        }
        _ => 30,
    }
}

#[tauri::command]
pub fn get_dashboard_data(
    state: State<'_, DbState>,
    low_stock_threshold: Option<i64>,
) -> Result<DashboardData, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let today = today_utc();
    let month_start = first_of_month(&today);
    let (prev_start, prev_end) = prev_month_range(&today);
    let thirty_ago = days_ago(30);
    let threshold = low_stock_threshold.unwrap_or(5);

    // Today's sales
    let (today_sales_total, today_sales_count): (f64, i64) = db
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
             FROM sales WHERE DATE(sale_date) = ?1 AND status != 'voided'",
            params![today],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    // This month's sales
    let (month_sales_total, month_sales_count): (f64, i64) = db
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
             FROM sales WHERE DATE(sale_date) BETWEEN ?1 AND ?2 AND status != 'voided'",
            params![month_start, today],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    // Last month's sales
    let last_month_sales_total: f64 = db
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0)
             FROM sales WHERE DATE(sale_date) BETWEEN ?1 AND ?2 AND status != 'voided'",
            params![prev_start, prev_end],
            |row| row.get(0),
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
             WHERE is_active = 1 AND stock_quantity > 0 AND stock_quantity <= ?1",
            params![threshold],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Sales last 30 days
    let mut stmt = db
        .prepare(
            "SELECT DATE(sale_date) as d, SUM(total_amount)
             FROM sales
             WHERE DATE(sale_date) >= ?1 AND status != 'voided'
             GROUP BY d ORDER BY d",
        )
        .map_err(|e| e.to_string())?;
    let sales_30 = stmt
        .query_map(params![thirty_ago], |row| {
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
        .query_map(params![thirty_ago], |row| {
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
                    COALESCE(c.name, 'Walk-in'), s.total_amount, s.payment_type
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
    })
}
