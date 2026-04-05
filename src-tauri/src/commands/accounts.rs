use tauri::State;

use crate::db::connection::DbState;
use crate::models::account::{
    AccountDetail, AccountPayment, InstallmentAccount, PaymentScheduleEntry, PenaltyApplied,
};
use crate::models::PaginatedResult;
use crate::services::penalty;
use crate::utils::constants::CENTAVO_TOLERANCE;
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
    // Track string param values so we can rebuild for both COUNT and data queries
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

    if let Some(ref acct_type) = account_type {
        match acct_type.as_str() {
            "installment" => conditions.push("ia.has_schedule = 1".to_string()),
            "utang" => conditions.push("ia.has_schedule = 0".to_string()),
            _ => {}
        }
    }

    if let Some(ref s) = search {
        if !s.is_empty() {
            conditions.push(format!("c.name LIKE ?{}", string_params.len() + 1));
            string_params.push(format!("%{}%", s));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // COUNT using a lighter query (no product JOINs needed for counting)
    let count_sql = format!(
        "SELECT COUNT(DISTINCT ia.id)
         FROM installment_accounts ia
         JOIN customers c ON c.id = ia.customer_id
         {}",
        where_clause
    );
    let count_params: Vec<Box<dyn rusqlite::types::ToSql>> = string_params
        .iter()
        .map(|v| Box::new(v.clone()) as Box<dyn rusqlite::types::ToSql>)
        .collect();
    let count_refs: Vec<&dyn rusqlite::types::ToSql> =
        count_params.iter().map(|p| p.as_ref()).collect();
    let total: u64 = conn
        .query_row(&count_sql, count_refs.as_slice(), |row| row.get(0))
        .unwrap_or(0);

    let pagination = match limit {
        Some(l) => format!("LIMIT {} OFFSET {}", l, offset.unwrap_or(0)),
        None => String::new(),
    };

    let sql = format!(
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
            ia.updated_at DESC {}",
        where_clause, pagination
    );

    let data_params: Vec<Box<dyn rusqlite::types::ToSql>> = string_params
        .iter()
        .map(|v| Box::new(v.clone()) as Box<dyn rusqlite::types::ToSql>)
        .collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        data_params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
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
                notes: row.get(18)?,
                created_at: row.get(19)?,
                updated_at: row.get(20)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let accounts: Vec<InstallmentAccount> = rows.filter_map(|r| r.ok()).collect();
    Ok(PaginatedResult { items: accounts, total })
}

#[tauri::command]
pub fn get_account_by_id(db: State<DbState>, id: i64) -> Result<AccountDetail, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let account = conn
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
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, f64>(5)?,
                    row.get::<_, f64>(6)?,
                    row.get::<_, f64>(7)?,
                    row.get::<_, f64>(8)?,
                    row.get::<_, f64>(9)?,
                    row.get::<_, bool>(10)?,
                    row.get::<_, Option<i64>>(11)?,
                    row.get::<_, Option<f64>>(12)?,
                    row.get::<_, Option<String>>(13)?,
                    row.get::<_, String>(14)?,
                    row.get::<_, Option<String>>(15)?,
                    row.get::<_, Option<String>>(16)?,
                    row.get::<_, bool>(17)?,
                    row.get::<_, Option<String>>(18)?,
                    row.get::<_, String>(19)?,
                    row.get::<_, String>(20)?,
                ))
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
        .filter_map(|r| r.ok())
        .collect();

    // Fetch payments
    let mut payment_stmt = conn
        .prepare(
            "SELECT id, amount, payment_date, type, notes
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
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(AccountDetail {
        id: account.0,
        sale_id: account.1,
        customer_id: account.2,
        customer_name: account.3,
        product_summary: account.4,
        principal: account.5,
        down_payment: account.6,
        interest_rate: account.7,
        penalty_rate: account.8,
        balance_remaining: account.9,
        has_schedule: account.10,
        term_months: account.11,
        monthly_amount: account.12,
        start_date: account.13,
        status: account.14,
        last_penalty_date: account.15,
        next_due_date: account.16,
        is_overdue: account.17,
        notes: account.18,
        created_at: account.19,
        updated_at: account.20,
        schedule,
        payments,
    })
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
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let results = penalty::check_and_apply_penalties(&conn)?;
    for p in &results {
        let _ = insert_audit(&conn, "penalty_applied", "account", Some(p.account_id), Some(&format!("₱{:.2} penalty", p.penalty_amount)));
    }
    Ok(results)
}

#[tauri::command]
pub fn recalculate_balance(db: State<DbState>, account_id: i64) -> Result<f64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Get account principal and down_payment
    let (principal, _down_payment): (f64, f64) = conn
        .query_row(
            "SELECT principal, down_payment FROM installment_accounts WHERE id = ?1",
            rusqlite::params![account_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| format!("Account {} not found", account_id))?;

    // Sum all payments (regular payments reduce balance)
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

    // Recalculate: principal - down_payment + penalties - payments (excluding down_payment since it's in principal calc)
    // Actually: balance = principal - all_payments + all_penalties
    // But down_payment is already part of principal structure, so:
    // balance = principal - down_payment + penalties - regular_payments
    // Wait — total_payments includes down_payment type, so:
    let new_balance = principal - total_payments + total_penalties;
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
