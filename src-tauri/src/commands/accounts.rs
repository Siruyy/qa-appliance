use tauri::State;

use crate::db::connection::DbState;
use crate::models::account::{
    AccountDetail, AccountPayment, InstallmentAccount, PaymentScheduleEntry, PenaltyApplied,
};
use crate::models::PaginatedResult;
use crate::services::penalty;
use crate::utils::constants::CENTAVO_TOLERANCE;
use crate::utils::query::{build_where, paginated_query};
use crate::utils::validation::optional_text;
use crate::commands::audit_log::insert_audit;

#[tauri::command]
pub fn get_accounts(
    db: State<DbState>,
    status_filter: Option<String>,
    account_type: Option<String>,
    search: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<PaginatedResult<InstallmentAccount>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut conditions: Vec<String> = Vec::new();
    let mut string_params: Vec<String> = Vec::new();

    if let Some(ref status) = status_filter {
        match status.as_str() {
            "overdue" => {
                conditions.push(
                    "ia.status = 'open' AND EXISTS (
                        SELECT 1 FROM payment_schedules ps
                        WHERE ps.account_id = ia.id AND ps.status = 'overdue'
                    )"
                    .to_string(),
                );
            }
            _ => {
                conditions.push(format!("ia.status = ?{}", string_params.len() + 1));
                string_params.push(status.clone());
            }
        }
    }

    // All accounts are now scheduled installments; account_type filter is a no-op
    let _ = &account_type;

    if let Some(ref s) = search {
        if !s.is_empty() {
            conditions.push(format!("c.name LIKE ?{}", string_params.len() + 1));
            string_params.push(format!("%{}%", s));
        }
    }

    let where_clause = build_where(&conditions);
    let params_boxed: Vec<Box<dyn rusqlite::types::ToSql>> = string_params
        .iter()
        .map(|v| Box::new(v.clone()) as Box<dyn rusqlite::types::ToSql>)
        .collect();
    let params: Vec<&dyn rusqlite::types::ToSql> =
        params_boxed.iter().map(|p| p.as_ref()).collect();

    let count_sql = format!(
        "SELECT COUNT(DISTINCT ia.id)
         FROM installment_accounts ia
         JOIN customers c ON c.id = ia.customer_id
         {}",
        where_clause
    );

    let data_sql = format!(
        "SELECT ia.id, ia.sale_id, ia.customer_id, c.name AS customer_name,
                COALESCE(
                    GROUP_CONCAT(DISTINCT p.name || COALESCE(' ' || v.attributes, '')),
                    'Unknown Product'
                ) AS product_summary,
                ia.principal, ia.down_payment, ia.interest_rate, ia.penalty_rate,
                ia.balance_remaining, ia.has_schedule, ia.term_months, ia.monthly_amount,
                ia.start_date, ia.status, ia.last_penalty_date,
                (SELECT MIN(ps.due_date) FROM payment_schedules ps
                 WHERE ps.account_id = ia.id AND ps.status IN ('pending', 'partial', 'overdue')
                ) AS next_due_date,
                CASE WHEN EXISTS (
                    SELECT 1 FROM payment_schedules ps
                    WHERE ps.account_id = ia.id AND ps.status = 'overdue'
                ) THEN 1 ELSE 0 END AS is_overdue,
                ia.rebate_rate,
                ia.notes, ia.created_at, ia.updated_at
         FROM installment_accounts ia
         JOIN customers c ON c.id = ia.customer_id
         JOIN sales s ON s.id = ia.sale_id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants v ON v.id = si.variant_id
         LEFT JOIN products p ON p.id = v.product_id
         {}
         GROUP BY ia.id
         ORDER BY
            CASE ia.status WHEN 'open' THEN 0 WHEN 'defaulted' THEN 1 ELSE 2 END,
            ia.updated_at DESC",
        where_clause
    );

    paginated_query(&conn, &count_sql, &data_sql, &params, limit, offset, |row| {
        Ok(InstallmentAccount {
            id: row.get(0)?,
            sale_id: row.get(1)?,
            customer_id: row.get(2)?,
            customer_name: row.get(3)?,
            product_summary: row.get(4)?,
            principal: row.get(5)?,
            down_payment: row.get(6)?,
            interest_rate: row.get(7)?,
            penalty_rate: row.get(8)?,
            balance_remaining: row.get(9)?,
            has_schedule: row.get(10)?,
            term_months: row.get(11)?,
            monthly_amount: row.get(12)?,
            start_date: row.get(13)?,
            status: row.get(14)?,
            last_penalty_date: row.get(15)?,
            next_due_date: row.get(16)?,
            is_overdue: row.get(17)?,
            rebate_rate: row.get(18)?,
            notes: row.get(19)?,
            created_at: row.get(20)?,
            updated_at: row.get(21)?,
        })
    })
}

#[tauri::command]
pub fn get_account_by_id(db: State<DbState>, id: i64) -> Result<AccountDetail, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut account: AccountDetail = conn
        .query_row(
            "SELECT ia.id, ia.sale_id, ia.customer_id, c.name AS customer_name,
                    COALESCE(
                        GROUP_CONCAT(DISTINCT p.name || COALESCE(' ' || v.attributes, '')),
                        'Unknown Product'
                    ) AS product_summary,
                    ia.principal, ia.down_payment, ia.interest_rate, ia.penalty_rate,
                    ia.balance_remaining, ia.has_schedule, ia.term_months, ia.monthly_amount,
                    ia.start_date, ia.status, ia.last_penalty_date,
                    (SELECT MIN(ps.due_date) FROM payment_schedules ps
                     WHERE ps.account_id = ia.id AND ps.status IN ('pending', 'partial', 'overdue')
                    ) AS next_due_date,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM payment_schedules ps
                        WHERE ps.account_id = ia.id AND ps.status = 'overdue'
                    ) THEN 1 ELSE 0 END AS is_overdue,
                    ia.rebate_rate,
                    ia.notes, ia.created_at, ia.updated_at
             FROM installment_accounts ia
             JOIN customers c ON c.id = ia.customer_id
             JOIN sales s ON s.id = ia.sale_id
             LEFT JOIN sale_items si ON si.sale_id = s.id
             LEFT JOIN product_variants v ON v.id = si.variant_id
             LEFT JOIN products p ON p.id = v.product_id
             WHERE ia.id = ?1
             GROUP BY ia.id",
            rusqlite::params![id],
            |row| {
                Ok(AccountDetail {
                    id: row.get(0)?,
                    sale_id: row.get(1)?,
                    customer_id: row.get(2)?,
                    customer_name: row.get(3)?,
                    product_summary: row.get(4)?,
                    principal: row.get(5)?,
                    down_payment: row.get(6)?,
                    interest_rate: row.get(7)?,
                    penalty_rate: row.get(8)?,
                    balance_remaining: row.get(9)?,
                    has_schedule: row.get(10)?,
                    term_months: row.get(11)?,
                    monthly_amount: row.get(12)?,
                    start_date: row.get(13)?,
                    status: row.get(14)?,
                    last_penalty_date: row.get(15)?,
                    next_due_date: row.get(16)?,
                    is_overdue: row.get(17)?,
                    rebate_rate: row.get(18)?,
                    notes: row.get(19)?,
                    created_at: row.get(20)?,
                    updated_at: row.get(21)?,
                    schedule: Vec::new(),
                    payments: Vec::new(),
                })
            },
        )
        .map_err(|_| format!("Account with id {} not found", id))?;

    // Fetch schedule entries
    let mut schedule_stmt = conn
        .prepare(
            "SELECT id, account_id, due_date, amount_due, amount_paid, status
             FROM payment_schedules
             WHERE account_id = ?1
             ORDER BY due_date ASC",
        )
        .map_err(|e| e.to_string())?;

    let schedule: Vec<PaymentScheduleEntry> = schedule_stmt
        .query_map(rusqlite::params![id], |row| {
            Ok(PaymentScheduleEntry {
                id: row.get(0)?,
                account_id: row.get(1)?,
                due_date: row.get(2)?,
                amount_due: row.get(3)?,
                amount_paid: row.get(4)?,
                status: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row read error: {}", e))?;

    // Fetch payments
    let mut payment_stmt = conn
        .prepare(
            "SELECT id, amount, payment_date, type, notes,
                    COALESCE(is_reversed, 0), reversed_at, reversed_reason
             FROM payments
             WHERE account_id = ?1
             ORDER BY payment_date DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;

    let payments: Vec<AccountPayment> = payment_stmt
        .query_map(rusqlite::params![id], |row| {
            Ok(AccountPayment {
                id: row.get(0)?,
                amount: row.get(1)?,
                payment_date: row.get(2)?,
                payment_type: row.get(3)?,
                notes: row.get(4)?,
                is_reversed: row.get::<_, i32>(5)? != 0,
                reversed_at: row.get(6)?,
                reversed_reason: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row read error: {}", e))?;

    account.schedule = schedule;
    account.payments = payments;

    Ok(account)
}

#[tauri::command]
pub fn get_overdue_accounts(db: State<DbState>) -> Result<Vec<InstallmentAccount>, String> {
    let result = get_accounts(db, Some("overdue".to_string()), None, None, None, None)?;
    Ok(result.items)
}

#[tauri::command]
pub fn mark_account_paid(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let balance: f64 = conn
        .query_row(
            "SELECT balance_remaining FROM installment_accounts WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| format!("Account {} not found", id))?;

    if balance > CENTAVO_TOLERANCE {
        return Err(format!(
            "Cannot mark as paid: account still has ₱{:.2} remaining balance",
            balance
        ));
    }

    conn.execute(
        "UPDATE installment_accounts SET status = 'paid', updated_at = datetime('now') WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    // Mark all remaining schedule entries as paid
    conn.execute(
        "UPDATE payment_schedules SET status = 'paid' WHERE account_id = ?1 AND status != 'paid'",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn mark_account_defaulted(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE installment_accounts SET status = 'defaulted', updated_at = datetime('now') WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_account_notes(db: State<DbState>, id: i64, notes: String) -> Result<(), String> {
    let notes = optional_text("Notes", &Some(notes), 5000)?.unwrap_or_default();
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE installment_accounts SET notes = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![notes, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn run_penalty_check(db: State<DbState>) -> Result<Vec<PenaltyApplied>, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let results = penalty::check_and_apply_penalties(&tx)?;
    for p in &results {
        let _ = insert_audit(&tx, "penalty_applied", "account", Some(p.account_id), Some(&format!("₱{:.2} penalty", p.penalty_amount)));
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(results)
}

#[tauri::command]
pub fn recalculate_balance(db: State<DbState>, account_id: i64) -> Result<f64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Get account financials needed for recalculation
    let (principal, interest_rate, term_months): (f64, f64, Option<i64>) = conn
        .query_row(
            "SELECT principal, interest_rate, term_months FROM installment_accounts WHERE id = ?1",
            rusqlite::params![account_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| format!("Account {} not found", account_id))?;

    // Recompute total_payable (principal + interest) from stored rate/term
    // Filipino add-on interest: principal × monthly_rate × term_months
    let total_interest = match term_months {
        Some(term) => principal * (interest_rate / 100.0) * term as f64,
        None => 0.0,
    };
    let total_payable = principal + total_interest;

    // Sum all payments (regular + down_payment reduce balance)
    let total_payments: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM payments
             WHERE account_id = ?1 AND type IN ('payment', 'down_payment')",
            rusqlite::params![account_id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Sum all penalties (increase balance)
    let total_penalties: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM payments
             WHERE account_id = ?1 AND type = 'penalty'",
            rusqlite::params![account_id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // Sum rebates (stored as negative amounts — credit to customer)
    let total_rebates: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(ABS(amount)), 0) FROM payments
             WHERE account_id = ?1 AND type = 'rebate'",
            rusqlite::params![account_id],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    // balance = total_payable - payments - rebates + penalties
    let new_balance = total_payable - total_payments - total_rebates + total_penalties;
    let new_balance = (new_balance * 100.0).round() / 100.0;
    let new_balance = if new_balance < 0.0 { 0.0 } else { new_balance };

    conn.execute(
        "UPDATE installment_accounts SET balance_remaining = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![new_balance, account_id],
    )
    .map_err(|e| e.to_string())?;

    // Auto-close if fully paid
    if new_balance <= 0.0 {
        conn.execute(
            "UPDATE installment_accounts SET status = 'paid', updated_at = datetime('now') WHERE id = ?1 AND status = 'open'",
            rusqlite::params![account_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(new_balance)
}

#[tauri::command]
pub fn update_account_rebate_rate(
    db: State<'_, DbState>,
    account_id: i64,
    rebate_rate: f64,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    if rebate_rate < 0.0 || rebate_rate > 100.0 {
        return Err("Rebate rate must be between 0 and 100".to_string());
    }

    let status: String = conn
        .query_row(
            "SELECT status FROM installment_accounts WHERE id = ?1",
            rusqlite::params![account_id],
            |row| row.get(0),
        )
        .map_err(|_| "Account not found".to_string())?;

    if status != "open" {
        return Err("Can only update rebate rate on open accounts".to_string());
    }

    conn.execute(
        "UPDATE installment_accounts SET rebate_rate = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![rebate_rate, account_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "update_rebate_rate",
            "installment_account",
            account_id.to_string(),
            format!("Updated rebate rate to {}%", rebate_rate)
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn restructure_account(
    db: State<'_, DbState>,
    account_id: i64,
    new_term_months: i64,
    new_monthly_rate: f64,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    if new_term_months < 1 || new_term_months > 60 {
        return Err("Term must be between 1 and 60 months".to_string());
    }
    if new_monthly_rate < 0.0 || new_monthly_rate > 20.0 {
        return Err("Monthly rate must be between 0 and 20%".to_string());
    }

    // Get current account state
    let (balance_remaining, status, _down_payment): (f64, String, f64) = conn
        .query_row(
            "SELECT balance_remaining, status, down_payment FROM installment_accounts WHERE id = ?1",
            rusqlite::params![account_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Account not found".to_string())?;

    if status != "open" {
        return Err("Can only restructure open accounts".to_string());
    }

    // Recalculate: new interest on remaining balance
    let new_interest = balance_remaining * (new_monthly_rate / 100.0) * new_term_months as f64;
    let new_total = balance_remaining + new_interest;
    let new_monthly = new_total / new_term_months as f64;

    // Update the account
    conn.execute(
        "UPDATE installment_accounts SET
            term_months = ?1,
            interest_rate = ?2,
            monthly_amount = ?3,
            balance_remaining = ?4,
            updated_at = datetime('now')
         WHERE id = ?5",
        rusqlite::params![new_term_months, new_monthly_rate, new_monthly, new_total, account_id],
    )
    .map_err(|e| e.to_string())?;

    // Delete old pending/overdue schedule entries (preserving paid history)
    conn.execute(
        "DELETE FROM payment_schedules WHERE account_id = ?1 AND status IN ('pending', 'overdue')",
        rusqlite::params![account_id],
    )
    .map_err(|e| e.to_string())?;

    // Generate new schedule entries starting from today using SQLite date math
    let today = crate::utils::date::today_iso();
    for i in 1..=new_term_months {
        let due_date: String = conn
            .query_row(
                "SELECT date(?1, '+' || ?2 || ' months')",
                rusqlite::params![today, i],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO payment_schedules (account_id, due_date, amount_due, amount_paid, status)
             VALUES (?1, ?2, ?3, 0, 'pending')",
            rusqlite::params![account_id, due_date, new_monthly],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "restructure_account",
            "installment_account",
            account_id.to_string(),
            format!(
                "Restructured: {} months @ {}%/mo, new monthly ₱{:.2}, new balance ₱{:.2}",
                new_term_months, new_monthly_rate, new_monthly, new_total
            )
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
