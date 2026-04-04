# Phase 4 — Accounts / Receivables & Payments

## Goal
Track all open installment and utang accounts. Record incoming payments. Auto-detect and apply overdue penalties. Full account detail with transaction timeline.

---

## Part A: Accounts Module

### Screen: Accounts Page (`/accounts`)

```
[Accounts / Receivables]
──────────────────────────────────────────────────────────────────────
[⚠ 3 accounts are overdue. View overdue →]          ← Alert banner (red)
──────────────────────────────────────────────────────────────────────
[Search: customer name...]  [Status: Open ▾]  [Type: All ▾]

  Customer     | Product Summary | Balance      | Type        | Next Due   | Status     | Actions
  ─────────────────────────────────────────────────────────────────────────────────────────────────────
  Maria Santos | Samsung Ref     | ₱ 12,500.00  | Installment | Apr 15 '26 | [OVERDUE]  | ⋯
  Juan Cruz    | LG Aircon       | ₱  6,000.00  | Utang       | —          | [OPEN]     | ⋯
  Ana Reyes    | Washing Machine | ₱     0.00   | Installment | —          | [PAID]     | ✓
```

**Filters:**
- Status: Open / Overdue / Paid / Defaulted / All
- Type: All / Installment (with schedule) / Utang (open-ended)
- Search: customer name

**Actions per row:** View Detail, Record Payment, Mark as Defaulted

---

### Screen: Account Detail (`/accounts/:id`)

```
[← Accounts]  Maria Santos — Samsung Ref 350L White       [Record Payment]
──────────────────────────────────────────────────────────────────────
  ACCOUNT SUMMARY
  Principal:       ₱ 20,500.00     Interest Rate: 5.00%/mo
  Down Payment:    ₱  1,000.00     Penalty Rate:  2.00%
  Balance:         ₱ 12,500.00     Status: [OVERDUE]
  Sale Date:       Apr 1, 2026     Type: Installment (12 months)
──────────────────────────────────────────────────────────────────────
  PAYMENT SCHEDULE (if has_schedule)
  #  | Due Date     | Amount Due  | Amount Paid | Status
  1  | Apr 15, 2026 | ₱ 1,750.00 | ₱ 1,000.00  | [PARTIAL]  ← overdue
  2  | May 15, 2026 | ₱ 1,750.00 | ₱       —   | [PENDING]
  3  | Jun 15, 2026 | ₱ 1,750.00 | ₱       —   | [PENDING]
  ...
──────────────────────────────────────────────────────────────────────
  PAYMENT HISTORY
  Date         | Amount       | Type         | Notes
  Apr 3, 2026  | ₱  2,000.00 | Payment      | Cash
  Apr 1, 2026  | ₱  1,000.00 | Down Payment | —
  Apr 1, 2026  | ₱    250.00 | Penalty      | Auto-applied
──────────────────────────────────────────────────────────────────────
```

---

### TypeScript Types (`src/types/account.ts`)

- [ ] Define:
  ```typescript
  export type AccountStatus = 'open' | 'paid' | 'defaulted'

  export interface PaymentScheduleEntry {
    id: number
    account_id: number
    due_date: string
    amount_due: number
    amount_paid: number
    status: 'pending' | 'paid' | 'overdue' | 'partial'
  }

  export interface InstallmentAccount {
    id: number
    sale_id: number
    customer_id: number
    customer_name: string        // joined
    product_summary: string      // joined from sale_items (e.g., "Samsung Ref, LG Aircon")
    principal: number
    down_payment: number
    interest_rate: number
    penalty_rate: number
    balance_remaining: number
    has_schedule: boolean
    term_months: number | null
    monthly_amount: number | null
    start_date: string | null
    status: AccountStatus
    last_penalty_date: string | null
    next_due_date: string | null  // computed: soonest pending schedule entry
    is_overdue: boolean           // computed
    schedule: PaymentScheduleEntry[]
    notes: string | null
    created_at: string
    updated_at: string
  }
  ```

### Zod Validation (`src/lib/validations/account.ts`)

- [ ] Validation schema not needed for account creation (created by `create_sale` in Phase 3)
- [ ] `updateAccountNotesSchema`:
  - `notes`: optional string max 500

---

### Rust: Penalty Service (`src-tauri/src/services/penalty.rs`)

This service runs on app startup and when the Accounts page is opened.

- [ ] `check_and_apply_penalties(conn) → Vec<PenaltyApplied>`:
  1. Query all `open` accounts
  2. For **scheduled accounts**: find schedule entries where `due_date < today AND status IN ('pending', 'partial')` → mark as `overdue`
  3. For **open accounts (no schedule)**: check `last_penalty_date` — if it's been ≥ 30 days (or null), apply penalty
  4. For any account where penalty conditions are met AND `last_penalty_date` is not today:
     - Calculate penalty = `balance_remaining × (penalty_rate / 100)`
     - INSERT into `payments` with `type = 'penalty'`
     - UPDATE `installment_accounts.balance_remaining += penalty`
     - UPDATE `installment_accounts.last_penalty_date = today`
  5. Return list of accounts that had penalties applied (for displaying a notification)

### Rust: Commands (`src-tauri/src/commands/accounts.rs`)

- [ ] `get_accounts(status_filter: Option<String>, search: Option<String>) → Vec<InstallmentAccount>`
  - JOINs: customers, sale_items + products (for product_summary), payment_schedules (for next_due_date)
  - Computes `is_overdue` in SQL or Rust post-processing
- [ ] `get_account_by_id(id: i64) → InstallmentAccount` (includes full schedule + payments)
- [ ] `get_overdue_accounts() → Vec<InstallmentAccount>`
- [ ] `mark_account_paid(id: i64) → ()` — sets status = 'paid' if balance = 0
- [ ] `mark_account_defaulted(id: i64) → ()`
- [ ] `update_account_notes(id: i64, notes: String) → ()`
- [ ] `run_penalty_check() → Vec<PenaltyApplied>` — calls penalty service
- [ ] `recalculate_balance(account_id: i64) → f64`
  - Recalculates from scratch: `principal - down_payment + all penalties + all interest adjustments - all payments`
  - Used for data integrity recovery

---

## Part B: Payments Module

### Screen: Payments Page (`/payments`)

```
[Payments / Collections]
──────────────────────────────────────────────────────────────
[Date Range: from] [to]   [Customer Search...]   [Export ▾]
──────────────────────────────────────────────────────────────
  Date         | Customer     | Account          | Amount       | Type
  ─────────────────────────────────────────────────────────────────────
  Apr 4, 2026  | Maria Santos | Samsung Ref      | ₱  2,000.00 | Payment
  Apr 1, 2026  | Maria Santos | Samsung Ref      | ₱  1,000.00 | Down Payment
  Apr 1, 2026  | Juan Cruz    | LG Aircon        | ₱    250.00 | Penalty
──────────────────────────────────────────────────────────────
  Total shown:  ₱ 3,250.00
```

- This is a **read-only log** of all collected payments (visibility/audit trail)
- Primary action of recording payments happens via the Account Detail page

---

### Record Payment Flow (from Account Detail page)

```
[Record Payment]
──────────────────────────────────────────────────────────────
Account:    Maria Santos — Samsung Ref (Balance: ₱12,500.00)
──────────────────────────────────────────────────────────────
Date:       [Apr 4, 2026]
Amount:     [₱ ___________]
Apply to:   ◉ Earliest overdue schedule entry    [If has_schedule]
            ○ Specific schedule entry: [dropdown]
Notes:      [optional]
──────────────────────────────────────────────────────────────
                                          [Cancel]  [Record]
```

**Behavior:**
- If amount >= schedule entry's remaining amount: mark that entry as `paid`, apply overflow to next entry
- If amount < schedule entry's remaining amount: mark entry as `partial`, update `amount_paid`
- Always: decrement `balance_remaining` on the account
- If `balance_remaining` reaches 0: auto-update account status to `paid`
- For open-ended accounts (no schedule): just record the payment and reduce balance

### TypeScript Types (`src/types/payment.ts`)

- [ ] Define:
  ```typescript
  export type PaymentType = 'payment' | 'penalty' | 'interest_adjustment' | 'down_payment'

  export interface Payment {
    id: number
    account_id: number
    schedule_id: number | null
    customer_name: string        // joined
    product_summary: string      // joined
    amount: number
    payment_date: string
    type: PaymentType
    notes: string | null
    created_at: string
  }

  export interface RecordPaymentPayload {
    account_id: number
    schedule_id: number | null
    amount: number
    payment_date: string
    notes: string | null
  }
  ```

### Zod Validation (`src/lib/validations/payment.ts`)

- [ ] `recordPaymentSchema`:
  - `account_id`: required integer > 0
  - `amount`: required number > 0
  - `payment_date`: required valid date string (cannot be in the future)
  - `notes`: optional string max 500

### Rust: Commands (`src-tauri/src/commands/payments.rs`)

- [ ] `get_payments(from_date: Option<String>, to_date: Option<String>, customer_id: Option<i64>) → Vec<Payment>`
- [ ] `get_payments_for_account(account_id: i64) → Vec<Payment>`
- [ ] `record_payment(payload: RecordPaymentPayload) → Payment`
  - Atomic transaction:
    1. INSERT into `payments`
    2. UPDATE `installment_accounts.balance_remaining -= amount`
    3. If `schedule_id` provided: UPDATE `payment_schedules.amount_paid` and recalculate schedule status
    4. If `balance_remaining <= 0`: UPDATE `installment_accounts.status = 'paid'`
  - Validates: `amount <= balance_remaining` (don't overpay)

---

### Frontend Components

- [ ] `AccountsPage.tsx`: table with alert banner, filters, overdue badge
- [ ] `AccountDetailPage.tsx`: full account view with schedule table + payment history
- [ ] `RecordPaymentModal.tsx`: payment entry form (amount, date, apply-to selection, notes)
- [ ] `PaymentsPage.tsx`: read-only payment log with date range filter + customer filter
- [ ] `ScheduleTable.tsx`: reusable table component for payment schedule entries
- [ ] `PaymentHistoryTable.tsx`: reusable table for payment transactions

---

## Startup Penalty Check

- [ ] In `App.tsx` (or `AppShell.tsx`), on mount:
  ```typescript
  useEffect(() => {
    invoke('run_penalty_check').then((applied) => {
      if (applied.length > 0) {
        toast.warning(`Penalties applied to ${applied.length} overdue account(s)`)
      }
    })
  }, [])
  ```

---

## Phase 4 Sign-off Checklist

- [ ] Accounts page shows all open accounts with correct balances
- [ ] Overdue alert banner appears and shows correct count
- [ ] Account detail shows schedule table with correct statuses
- [ ] Payment history shows all transactions including auto-penalties
- [ ] Recording a payment updates balance and schedule entry status
- [ ] Recording a payment that covers the full balance auto-closes account
- [ ] Partial payment marks schedule entry as `partial`
- [ ] Penalty auto-applies on app startup for overdue accounts
- [ ] Penalty not double-applied on same day
- [ ] Open-ended (utang) accounts accept payments without schedule
- [ ] Payments log page shows all payments in date range
- [ ] No TypeScript errors
