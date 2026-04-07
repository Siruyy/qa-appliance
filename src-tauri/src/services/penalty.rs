use rusqlite::Connection;

use crate::models::account::PenaltyApplied;
use crate::utils::constants::PENALTY_COOLDOWN_DAYS;
use crate::utils::date::today_iso;
use crate::utils::format::format_product_summary;

/// Read a setting as an integer, returning a default if not found or unparseable.
fn read_setting_i64(conn: &Connection, key: &str, default: i64) -> i64 {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .and_then(|v| v.parse::<i64>().ok())
    .unwrap_or(default)
}

/// Check all open accounts for overdue schedule entries and apply penalties where needed.
///
/// Logic:
/// 1. Mark overdue schedule entries (respecting grace_period_days)
/// 2. Single query: find accounts with overdue entries AND cooldown elapsed
/// 3. Skip accounts that have hit max_penalties_per_account
/// 4. Penalty = principal × (penalty_rate / 100)
pub fn check_and_apply_penalties(conn: &Connection) -> Result<Vec<PenaltyApplied>, String> {
    let today = today_iso();
    let mut penalties_applied: Vec<PenaltyApplied> = Vec::new();

    let grace_period_days = read_setting_i64(conn, "grace_period_days", 0);
    let max_penalties = read_setting_i64(conn, "max_penalties_per_account", 0);

    // Step 1: Mark overdue schedule entries (accounting for grace period)
    conn.execute(
        "UPDATE payment_schedules SET status = 'overdue'
         WHERE status IN ('pending', 'partial')
         AND date(due_date, '+' || ?2 || ' days') < ?1
         AND account_id IN (
            SELECT id FROM installment_accounts WHERE status = 'open'
         )",
        rusqlite::params![today, grace_period_days],
    )
    .map_err(|e| format!("Failed to mark overdue entries: {}", e))?;

    // Step 2: Find penalty-eligible accounts in one query.
    let mut stmt = conn
        .prepare(
            "SELECT ia.id, ia.principal, ia.penalty_rate,
                    ia.balance_remaining, c.name AS customer_name,
                    COALESCE(
                        GROUP_CONCAT(DISTINCT p.name || COALESCE(' ' || v.attributes, '')),
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
               AND ia.balance_remaining > 0
               AND (ia.last_penalty_date IS NULL
                    OR julianday(?1) - julianday(ia.last_penalty_date) >= ?2)
               AND EXISTS (
                   SELECT 1 FROM payment_schedules ps
                   WHERE ps.account_id = ia.id AND ps.status = 'overdue'
               )
             GROUP BY ia.id",
        )
        .map_err(|e| format!("Failed to query accounts for penalty: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![today, PENALTY_COOLDOWN_DAYS], |row| {
            Ok((
                row.get::<_, i64>(0)?,   // id
                row.get::<_, f64>(1)?,   // principal
                row.get::<_, f64>(2)?,   // penalty_rate
                row.get::<_, f64>(3)?,   // balance_remaining
                row.get::<_, String>(4)?, // customer_name
                row.get::<_, String>(5)?, // product_summary
            ))
        })
        .map_err(|e| format!("Failed to read penalty candidates: {}", e))?;

    let candidates: Vec<_> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("Row read error: {}", e))?;

    for (account_id, principal, penalty_rate, _balance_remaining, customer_name, raw_summary) in candidates {
        let product_summary = format_product_summary(&raw_summary);
        // Check max penalties cap (0 = unlimited)
        if max_penalties > 0 {
            let penalty_count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM payments WHERE account_id = ?1 AND type = 'penalty' AND is_reversed = 0",
                    rusqlite::params![account_id],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            if penalty_count >= max_penalties {
                continue;
            }
        }

        // Penalty is computed on original principal to prevent compound spiral
        let penalty_amount = (principal * penalty_rate / 100.0 * 100.0).round() / 100.0;
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
