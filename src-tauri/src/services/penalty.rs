use rusqlite::Connection;

use crate::models::account::PenaltyApplied;

/// Check all open accounts for overdue schedule entries and apply penalties where needed.
///
/// Logic:
/// 1. For scheduled accounts: mark overdue schedule entries
/// 2. For all open accounts: apply penalty if conditions met and not already applied today
/// 3. Penalty = balance_remaining × (penalty_rate / 100)
pub fn check_and_apply_penalties(conn: &Connection) -> Result<Vec<PenaltyApplied>, String> {
    let today = chrono_today();
    let mut penalties_applied: Vec<PenaltyApplied> = Vec::new();

    // Step 1: Mark overdue schedule entries
    conn.execute(
        "UPDATE payment_schedules SET status = 'overdue'
         WHERE status IN ('pending', 'partial')
         AND due_date < ?1
         AND account_id IN (
            SELECT id FROM installment_accounts WHERE status = 'open'
         )",
        rusqlite::params![today],
    )
    .map_err(|e| format!("Failed to mark overdue entries: {}", e))?;

    // Step 2: Find accounts eligible for penalty
    // Conditions:
    //   - status = 'open'
    //   - penalty_rate > 0
    //   - Has overdue schedule entries OR (no schedule AND last_penalty_date is NULL or >= 30 days ago)
    //   - last_penalty_date is NOT today (prevent double-apply)
    let mut stmt = conn
        .prepare(
            "SELECT ia.id, ia.balance_remaining, ia.penalty_rate, ia.has_schedule,
                    ia.last_penalty_date, c.name AS customer_name,
                    COALESCE(
                        GROUP_CONCAT(DISTINCT p.name || COALESCE(' ' || v.attributes, ''), ', '),
                        'Unknown Product'
                    ) AS product_summary
             FROM installment_accounts ia
             JOIN customers c ON c.id = ia.customer_id
             JOIN sales s ON s.id = ia.sale_id
             LEFT JOIN sale_items si ON si.sale_id = s.id
             LEFT JOIN product_variants v ON v.id = si.variant_id
             LEFT JOIN products p ON p.id = v.product_id
             WHERE ia.status = 'open'
               AND ia.penalty_rate > 0
               AND (ia.last_penalty_date IS NULL OR ia.last_penalty_date < ?1)
             GROUP BY ia.id",
        )
        .map_err(|e| format!("Failed to query accounts for penalty: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![today], |row| {
            Ok((
                row.get::<_, i64>(0)?,          // id
                row.get::<_, f64>(1)?,          // balance_remaining
                row.get::<_, f64>(2)?,          // penalty_rate
                row.get::<_, bool>(3)?,         // has_schedule
                row.get::<_, Option<String>>(4)?, // last_penalty_date
                row.get::<_, String>(5)?,       // customer_name
                row.get::<_, String>(6)?,       // product_summary
            ))
        })
        .map_err(|e| format!("Failed to read penalty candidates: {}", e))?;

    let candidates: Vec<_> = rows.filter_map(|r| r.ok()).collect();

    for (account_id, balance, penalty_rate, has_schedule, last_penalty_date, customer_name, product_summary) in candidates {
        let should_penalize = if has_schedule {
            // Check if there are overdue entries for this account
            let overdue_count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM payment_schedules
                     WHERE account_id = ?1 AND status = 'overdue'",
                    rusqlite::params![account_id],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            overdue_count > 0
        } else {
            // Open-ended: penalize if last_penalty_date is NULL or >= 30 days ago
            match &last_penalty_date {
                None => true,
                Some(date) => days_since(date, &today) >= 30,
            }
        };

        if !should_penalize || balance <= 0.0 {
            continue;
        }

        let penalty_amount = (balance * penalty_rate / 100.0 * 100.0).round() / 100.0;
        if penalty_amount <= 0.0 {
            continue;
        }

        // Apply penalty: insert payment record
        conn.execute(
            "INSERT INTO payments (account_id, amount, payment_date, type, notes)
             VALUES (?1, ?2, ?3, 'penalty', 'Auto-applied overdue penalty')",
            rusqlite::params![account_id, penalty_amount, today],
        )
        .map_err(|e| format!("Failed to insert penalty payment: {}", e))?;

        // Update account balance and last_penalty_date
        conn.execute(
            "UPDATE installment_accounts
             SET balance_remaining = balance_remaining + ?1,
                 last_penalty_date = ?2,
                 updated_at = datetime('now')
             WHERE id = ?3",
            rusqlite::params![penalty_amount, today, account_id],
        )
        .map_err(|e| format!("Failed to update account after penalty: {}", e))?;

        penalties_applied.push(PenaltyApplied {
            account_id,
            customer_name,
            product_summary,
            penalty_amount,
        });
    }

    Ok(penalties_applied)
}

fn chrono_today() -> String {
    // Use SQLite-compatible date format
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    // Simple date formatting without chrono dependency
    let days = now / 86400;
    let (year, month, day) = days_to_ymd(days as i64 + 719468);
    format!("{:04}-{:02}-{:02}", year, month, day)
}

fn days_to_ymd(days: i64) -> (i64, u32, u32) {
    // Civil days to Y-M-D (algorithm from Howard Hinnant)
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = (days - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

fn days_since(from: &str, to: &str) -> i64 {
    let parse_date = |s: &str| -> Option<i64> {
        let parts: Vec<&str> = s.split('-').collect();
        if parts.len() < 3 {
            return None;
        }
        let y: i64 = parts[0].parse().ok()?;
        let m: u32 = parts[1].parse().ok()?;
        let d: u32 = parts[2].parse().ok()?;
        // Convert to days since epoch using inverse of days_to_ymd
        let (y, m) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
        let era = if y >= 0 { y } else { y - 399 } / 400;
        let yoe = (y - era * 400) as u32;
        let doy = (153 * m + 2) / 5 + d - 1;
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        Some(era * 146097 + doe as i64 - 719468)
    };

    match (parse_date(from), parse_date(to)) {
        (Some(f), Some(t)) => t - f,
        _ => 0,
    }
}
