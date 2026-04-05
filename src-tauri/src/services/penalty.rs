use rusqlite::Connection;

use crate::models::account::PenaltyApplied;
use crate::utils::constants::PENALTY_COOLDOWN_DAYS;
use crate::utils::date::{today_iso, days_since};

/// Check all open accounts for overdue schedule entries and apply penalties where needed.
///
/// Logic:
/// 1. Mark overdue schedule entries
/// 2. For all open accounts: apply penalty if overdue entries exist, cooldown met, not already applied today
/// 3. Penalty = balance_remaining × (penalty_rate / 100)
pub fn check_and_apply_penalties(conn: &Connection) -> Result<Vec<PenaltyApplied>, String> {
    let today = today_iso();
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
    //   - Has overdue schedule entries
    //   - last_penalty_date is NULL or cooldown elapsed (prevent frequent penalties)
    let mut stmt = conn
        .prepare(
            "SELECT ia.id, ia.balance_remaining, ia.penalty_rate,
                    ia.last_penalty_date, c.name AS customer_name,
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
               AND (ia.last_penalty_date IS NULL OR ia.last_penalty_date < ?1)
             GROUP BY ia.id",
        )
        .map_err(|e| format!("Failed to query accounts for penalty: {}", e))?;

    let rows = stmt
        .query_map(rusqlite::params![today], |row| {
            Ok((
                row.get::<_, i64>(0)?,            // id
                row.get::<_, f64>(1)?,            // balance_remaining
                row.get::<_, f64>(2)?,            // penalty_rate
                row.get::<_, Option<String>>(3)?, // last_penalty_date
                row.get::<_, String>(4)?,         // customer_name
                row.get::<_, String>(5)?,         // product_summary
            ))
        })
        .map_err(|e| format!("Failed to read penalty candidates: {}", e))?;

    let candidates: Vec<_> = rows.filter_map(|r| r.ok()).collect();

    for (account_id, balance, penalty_rate, last_penalty_date, customer_name, product_summary) in candidates {
        // All accounts have schedules — check for overdue entries + cooldown
        let overdue_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM payment_schedules
                 WHERE account_id = ?1 AND status = 'overdue'",
                rusqlite::params![account_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let should_penalize = overdue_count > 0
            && match &last_penalty_date {
                None => true,
                Some(date) => days_since(date, &today) >= PENALTY_COOLDOWN_DAYS,
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
