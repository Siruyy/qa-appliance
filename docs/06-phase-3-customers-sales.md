# Phase 3 — Customers & Sales

## Goal
Customer CRUD with full profile and balance overview. New Sale flow — select products, set quantities, choose payment type (cash or installment/utang), confirm transaction.

---

## Part A: Customers Module

### Screen: Customers Page (`/customers`)

```
[Customers]                                 [+ Add Customer]
───────────────────────────────────────────────────────────────
[Search: name or phone...]     [Status: Active ▾]
───────────────────────────────────────────────────────────────
  Name | Phone | Address | Open Accounts | Total Balance | Actions
───────────────────────────────────────────────────────────────
  Maria Santos | 09171234567 | Tondo, Manila | 2 accounts | ₱18,500.00 | ⋯
```

- Clicking a customer row opens their **Customer Detail view**
- "Open Accounts" and "Total Balance" are computed by joining installment_accounts
- Search by name OR phone number

### Customer Detail View (`/customers/:id` or slide-out panel)
```
[← Back]  Maria Santos                    [Edit] [Archive]
──────────────────────────────────────────────────────────
Contact: 09171234567  |  Tondo, Manila
Notes: Co-maker: Juan dela Cruz
──────────────────────────────────────────────────────────
  OPEN ACCOUNTS (2)
  [AccountMiniCard: Samsung Ref — ₱12,500 remaining — OVERDUE]
  [AccountMiniCard: LG Aircon — ₱6,000 remaining — PENDING]
──────────────────────────────────────────────────────────
  SALES HISTORY
  [SaleRow: Apr 1, 2026 — Samsung Ref 350L — ₱20,500 — Installment]
  [SaleRow: Mar 5, 2026 — LG Aircon 1.5HP — ₱18,000 — Installment]
──────────────────────────────────────────────────────────
  PAYMENT HISTORY
  [PaymentRow: Apr 3, 2026 — ₱2,000 — Account #1]
  [PaymentRow: Mar 20, 2026 — ₱2,000 — Account #1]
```

---

### TypeScript Types (`src/types/customer.ts`)

- [ ] Define:
  ```typescript
  export interface Customer {
    id: number
    name: string
    phone: string | null
    address: string | null
    notes: string | null
    is_active: boolean
    open_accounts_count: number    // computed on query
    total_balance: number          // computed on query
    created_at: string
    updated_at: string
  }

  export type CreateCustomerPayload = Pick<Customer, 'name' | 'phone' | 'address' | 'notes'>
  export type UpdateCustomerPayload = CreateCustomerPayload & { id: number }
  ```

### Zod Validation (`src/lib/validations/customer.ts`)

- [ ] `customerSchema`:
  - `name`: required, min 1, max 200, trimmed
  - `phone`: optional, max 20, numeric characters only (allow +, spaces, dashes)
  - `address`: optional, max 500
  - `notes`: optional, max 500

### Rust: Models (`src-tauri/src/models/customer.rs`)

- [ ] Define `Customer`, `CreateCustomerPayload`, `UpdateCustomerPayload` structs

### Rust: Commands (`src-tauri/src/commands/customers.rs`)

- [ ] `get_customers(include_archived: bool, search: Option<String>) → Vec<Customer>`
  - LEFT JOIN with `installment_accounts` to compute `open_accounts_count` and `total_balance`
  - Filter by name OR phone via `LIKE %search%`
- [ ] `get_customer_by_id(id: i64) → CustomerDetail`
  - Returns full customer + their sales + accounts + payments
- [ ] `create_customer(payload: CreateCustomerPayload) → Customer`
- [ ] `update_customer(payload: UpdateCustomerPayload) → Customer`
- [ ] `archive_customer(id: i64) → Result<(), String>`
  - Fail if customer has open accounts

### Frontend Components

- [ ] `CustomersPage.tsx`: table with search + status filter
- [ ] `CustomerFormModal.tsx`: create/edit form
- [ ] `CustomerDetailPage.tsx` (or sliding panel): full customer profile with linked accounts, sales, and payments
- [ ] `AccountMiniCard.tsx`: compact account status card used in customer detail

---

## Part B: Sales Module

### Screen: New Sale (`/sales/new`)

This is the most important workflow in the system. Treat it like a POS-style order form.

```
NEW SALE
──────────────────────────────────────────────────────────────
CUSTOMER                                      [+ New Customer]
[Search or select customer...]

ITEMS
──────────────────────────────────────────────────────────────
[Search product / variant...]         [+ Add Item]

  Product                  Qty    Unit Price    Subtotal   [x]
  ──────────────────────────────────────────────────────────
  Samsung Ref 350L White    1     ₱ 20,500.00   ₱ 20,500.00
  LG Aircon 1.5HP           2     ₱ 18,000.00   ₱ 36,000.00
  ──────────────────────────────────────────────────────────
  Discount:                                     ₱      0.00
  ──────────────────────────────────────────────────────────
  TOTAL:                                        ₱ 56,500.00

PAYMENT TYPE
  ◉ Cash         ○ Installment / Utang

  [If Cash selected: nothing extra shown]

  [If Installment selected:]
  ────────────────────────────────────────────────────────
  Down Payment:      [₱ ___________]
  Interest Rate:     [5.00] %/month    (from settings default)
  
  ☑ Set Payment Schedule (uncheck = open-ended utang)
    Term:     [12] months  [preset: 3 | 6 | 12 | 18 | 24]
    Monthly:  ₱ 4,375.00  ← auto-calculated (read-only display)
    Starts:   [Apr 15, 2026] (date picker)
  
  Penalty Rate:  [2.00] %  (from settings default, editable)
  Notes:         [optional notes...]

  [Preview Schedule Button] → shows a popup table of all due dates + amounts

──────────────────────────────────────────────────────────────
                                        [Cancel]  [Confirm Sale]
```

### New Sale Behavior

- [ ] Customer field is **required** for installment sales, optional for cash
- [ ] Product search is a real-time searchable dropdown showing: product name + variant attributes + stock qty
- [ ] Typing in search filters by product name or variant attributes
- [ ] Items added to a line-item list with editable Qty
- [ ] Removing an item from the list updates totals
- [ ] Discount field: flat amount, reduces total
- [ ] Interest calculations happen client-side (real-time) using `src/lib/interest.ts`
- [ ] Monthly amount shown as read-only, recalculates when principal/rate/term/down payment changes
- [ ] "Preview Schedule" opens a `PaymentSchedulePreviewModal` — read-only table of all payment entries
- [ ] "Confirm Sale" triggers:
  1. Validate all required fields (Zod)
  2. Call Rust `create_sale` command with full payload
  3. Rust atomically: inserts sale + sale_items, decrements stock, creates installment_account, creates payment_schedule rows (if applicable), records down payment as a payment
  4. On success: navigate to the new Account page (if installment) or back to sales history (if cash)
  5. Show success toast

---

### TypeScript Types (`src/types/sale.ts`)

- [ ] Define:
  ```typescript
  export type PaymentType = 'cash' | 'installment'

  export interface SaleItem {
    variant_id: number
    product_name: string   // display only
    variant_attributes: string // display only (e.g. "White, 350L")
    quantity: number
    unit_price: number
    subtotal: number
  }

  export interface Sale {
    id: number
    customer_id: number | null
    customer_name: string | null   // joined
    sale_date: string
    subtotal: number
    discount: number
    total: number
    payment_type: PaymentType
    status: 'completed' | 'voided'
    notes: string | null
    items: SaleItem[]
    created_at: string
  }

  export interface CreateSalePayload {
    customer_id: number | null
    items: Array<{ variant_id: number; quantity: number; unit_price: number }>
    discount: number
    payment_type: PaymentType
    notes: string | null
    installment?: CreateInstallmentPayload
  }

  export interface CreateInstallmentPayload {
    down_payment: number
    interest_rate: number
    penalty_rate: number
    has_schedule: boolean
    term_months: number | null
    start_date: string | null
  }
  ```

### Zod Validation (`src/lib/validations/sale.ts`)

- [ ] `saleItemSchema`:
  - `variant_id`: required integer > 0
  - `quantity`: required integer ≥ 1
  - `unit_price`: required number ≥ 0
- [ ] `createSaleSchema`:
  - `items`: array min 1 of `saleItemSchema`
  - `discount`: number ≥ 0
  - `payment_type`: enum `['cash', 'installment']`
  - `customer_id`: required if `payment_type === 'installment'`
  - `installment`: required and valid if `payment_type === 'installment'`
- [ ] `installmentSchema`:
  - `down_payment`: number ≥ 0 < total
  - `interest_rate`: number ≥ 0 ≤ 100
  - `penalty_rate`: number ≥ 0 ≤ 100
  - `term_months`: integer ≥ 1 if `has_schedule = true`
  - `start_date`: valid date string if `has_schedule = true`

### Interest Calculation Helpers (`src/lib/interest.ts`)

- [ ] `calculateAddOnInterest(principal, downPayment, monthlyRate, termMonths)`:
  ```
  financed = principal - downPayment
  totalInterest = financed × (monthlyRate / 100) × termMonths
  monthlyPayment = (financed + totalInterest) / termMonths
  ```
- [ ] `generatePaymentSchedule(startDate, termMonths, monthlyAmount)` → `Array<{ due_date: string, amount_due: number }>`

### Rust: Commands (`src-tauri/src/commands/sales.rs`)

- [ ] `get_sales(from_date: Option<String>, to_date: Option<String>, payment_type: Option<String>) → Vec<Sale>`
- [ ] `get_sale_by_id(id: i64) → Sale` (includes items)
- [ ] `create_sale(payload: CreateSalePayload) → Sale`
  - Atomic transaction:
    1. INSERT into `sales`
    2. INSERT each item into `sale_items`
    3. UPDATE `product_variants.stock_qty -= quantity` for each item
    4. If installment: INSERT `installment_accounts`
    5. If installment + has_schedule: INSERT all `payment_schedules` rows
    6. If installment + down_payment > 0: INSERT `payments` with type `down_payment`
  - Entire operation in a single SQLite transaction — rolls back if any step fails
- [ ] `void_sale(id: i64) → Result<(), String>`
  - Set `sales.status = 'voided'`
  - Restore stock quantities
  - Only voidable if no payments recorded on the account yet

### Frontend: Zustand Sale Store (`src/stores/saleStore.ts`)

- [ ] Cart state:
  - `items: SaleItem[]`
  - `customer: Customer | null`
  - `discount: number`
  - `paymentType: PaymentType`
  - `installmentConfig: CreateInstallmentPayload | null`
- [ ] Actions:
  - `addItem(variant, qty, price)`
  - `updateItemQty(variantId, qty)`
  - `removeItem(variantId)`
  - `setCustomer(customer | null)`
  - `setDiscount(amount)`
  - `setPaymentType(type)`
  - `setInstallmentConfig(config)`
  - `clearCart()`
- [ ] Derived (selectors):
  - `subtotal` = sum of item subtotals
  - `total` = subtotal - discount
  - `monthlyAmount` = calculated from installment config + total

### Frontend: Components

- [ ] `NewSalePage.tsx`: full sale creation form
- [ ] `ProductSearchDropdown.tsx`: type-ahead search, shows variant details + stock
- [ ] `SaleItemRow.tsx`: line item with qty input + remove button
- [ ] `InstallmentConfigPanel.tsx`: collapsible panel, shown when payment type = installment
- [ ] `PaymentSchedulePreviewModal.tsx`: read-only table of projected schedule

### Screen: Sales History (`/sales`)
- [ ] Table: date, customer, items summary, total, payment type, status
- [ ] Date range filter
- [ ] Payment type filter (All / Cash / Installment)
- [ ] Clicking a row opens a read-only Sale Detail modal
- [ ] Void button on each cash sale row (installment sales are managed via Accounts)

---

## Phase 3 Sign-off Checklist

- [ ] Can create a customer
- [ ] Can search customers by name and phone
- [ ] Customer detail page shows linked accounts, sales, payments
- [ ] Can add items to a sale (product search works)
- [ ] Subtotal, discount, total calculate correctly in real time
- [ ] Cash sale closes and stock is decremented
- [ ] Installment sale creates account + payment schedule
- [ ] Down payment recorded automatically when sale is completed
- [ ] Preview schedule modal shows correct dates and amounts
- [ ] Open-ended utang (no-schedule) creates account without schedule rows
- [ ] Voiding a cash sale restores stock
- [ ] All form validations trigger appropriate errors
- [ ] No TypeScript errors
