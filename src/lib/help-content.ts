export interface HelpArticleTip {
  title: string;
  body: string;
}

export interface HelpArticleFAQ {
  question: string;
  answer: string;
}

export interface HelpArticle {
  id: string;
  /** Page/section title */
  title: string;
  /** Category for grouping in help center */
  category: "getting-started" | "sales" | "inventory" | "customers" | "accounts" | "reports" | "system";
  /** One-line summary */
  summary: string;
  /** Detailed tips / how-to steps */
  tips: HelpArticleTip[];
  /** Frequently asked questions */
  faq: HelpArticleFAQ[];
  /** Route paths this article applies to */
  routes: string[];
  /** Keywords for search matching */
  keywords: string[];
}

export interface FirstTimeHint {
  /** Route path (exact or startsWith match) */
  route: string;
  /** Short heading */
  title: string;
  /** 1-3 quick tips to show */
  tips: string[];
}

// ---------------------------------------------------------------------------
// Help Articles — one per page / major feature
// ---------------------------------------------------------------------------

export const helpArticles: HelpArticle[] = [
  // ── Dashboard ──────────────────────────────────────────────────────
  {
    id: "dashboard",
    title: "Dashboard",
    category: "getting-started",
    summary: "Your daily overview of sales, receivables, and alerts at a glance.",
    routes: ["/dashboard"],
    keywords: ["dashboard", "kpi", "overview", "sales today", "overdue", "receivables", "charts"],
    tips: [
      {
        title: "KPI Cards",
        body: "The four cards at the top show today's sales, this month's total, total outstanding receivables, and overdue amounts. Click the overdue or low-stock badges to jump directly to those pages.",
      },
      {
        title: "Chart Time Range",
        body: "Use the 7d / 30d / 60d / 90d buttons above the charts to change the time range. The sales chart shows daily revenue, and the collections chart shows daily payment receipts.",
      },
      {
        title: "Refresh Data",
        body: "Press the Refresh button at the bottom, or use F5 / Ctrl+R to reload all dashboard data.",
      },
    ],
    faq: [
      {
        question: "Why does 'This Month' show a percentage?",
        answer: "It compares this month's sales total to last month's. A positive percentage means sales are up compared to the previous month.",
      },
      {
        question: "What counts as 'overdue'?",
        answer: "An account is overdue when it has unpaid installment payments past their due date. The overdue badge shows the count and total amount.",
      },
    ],
  },

  // ── Inventory ──────────────────────────────────────────────────────
  {
    id: "inventory",
    title: "Inventory",
    category: "inventory",
    summary: "Manage your products, variants, stock levels, and categories.",
    routes: ["/inventory"],
    keywords: ["inventory", "products", "variants", "stock", "categories", "add product", "adjust stock"],
    tips: [
      {
        title: "Products vs Variants",
        body: "A product (e.g., 'Samsung Refrigerator') can have multiple variants (e.g., different colors or sizes). Each variant has its own SKU, price, and stock quantity.",
      },
      {
        title: "Adding a Product",
        body: "Click '+ Add Product' to create a new product. Fill in the name, category, and base price. After saving, you can add variants with specific attributes.",
      },
      {
        title: "Stock Adjustments",
        body: "Use the stock adjustment button (on each variant row) to add or remove stock. Every adjustment is logged with a reason for audit purposes.",
      },
      {
        title: "Active vs Inactive",
        body: "Deactivating a product hides it from new sales but keeps it in your history. This is a soft delete — the product is never truly removed.",
      },
    ],
    faq: [
      {
        question: "Can I delete a product?",
        answer: "No. Products are soft-deleted (deactivated) to preserve sale history. Set a product to inactive instead.",
      },
      {
        question: "What are variant attributes?",
        answer: "Attributes are properties like color, size, or model stored as key-value pairs (e.g., Color: White, Size: 350L).",
      },
      {
        question: "How does low stock work?",
        answer: "When a variant's stock falls below the low stock threshold (set in Settings), it appears in the dashboard low-stock alert.",
      },
    ],
  },

  // ── Customers ──────────────────────────────────────────────────────
  {
    id: "customers",
    title: "Customers",
    category: "customers",
    summary: "Manage customer records and view their purchase and account history.",
    routes: ["/customers"],
    keywords: ["customers", "add customer", "customer history", "contact", "address"],
    tips: [
      {
        title: "Adding a Customer",
        body: "Click '+ Add Customer' and fill in their name, contact number, and address. Customers must be created before recording installment sales.",
      },
      {
        title: "Customer Detail",
        body: "Click a customer row to see their full profile, purchase history, and any active installment accounts.",
      },
      {
        title: "Deactivating a Customer",
        body: "Deactivating a customer hides them from new sales but keeps all their history intact. You cannot deactivate a customer with open accounts.",
      },
    ],
    faq: [
      {
        question: "Can I delete a customer?",
        answer: "No. Like products, customers are soft-deleted (deactivated) to preserve account and sale history.",
      },
      {
        question: "Do I need a customer for cash sales?",
        answer: "Cash sales can use a walk-in / anonymous customer. Only installment sales require a named customer record.",
      },
    ],
  },

  // ── New Sale ───────────────────────────────────────────────────────
  {
    id: "new-sale",
    title: "New Sale",
    category: "sales",
    summary: "Record a new cash or installment sale step by step.",
    routes: ["/sales/new"],
    keywords: ["new sale", "cash sale", "installment", "interest", "down payment", "receipt"],
    tips: [
      {
        title: "Selecting Products",
        body: "Use the search dropdown to find products by name or SKU. Select a variant, set the quantity, and it will be added to the sale items list.",
      },
      {
        title: "Cash vs Installment",
        body: "Cash sales are paid in full immediately. Installment sales create an account with a payment schedule. Choose the payment type before completing the sale.",
      },
      {
        title: "Installment Configuration",
        body: "For installment sales, set the down payment, interest rate, and term (months). Use the preset buttons for common values or enter custom amounts.",
      },
      {
        title: "Interest Calculation",
        body: "This system uses add-on (flat) interest: Total Interest = Principal × Monthly Rate × Term. It's not compounding — the total interest is fixed at the start.",
      },
      {
        title: "Preview Schedule",
        body: "Before finalizing, click 'Preview Schedule' to see the exact monthly payment amounts and due dates. Verify everything looks correct.",
      },
    ],
    faq: [
      {
        question: "What is add-on interest?",
        answer: "Add-on (flat) interest calculates total interest upfront: Principal × Rate × Months. The monthly payment is (Principal + Total Interest − Down Payment) ÷ Months. Unlike reducing balance, the interest amount doesn't decrease as you pay.",
      },
      {
        question: "Can I change the price during a sale?",
        answer: "The unit price is pulled from the variant's current price. Once the sale is saved, the price is snapshotted and never changes — even if you later update the product price.",
      },
      {
        question: "What happens to stock when I save a sale?",
        answer: "Stock quantities are automatically decremented for each item in the sale. If you void the sale later, stock is restored.",
      },
    ],
  },

  // ── Sales History ──────────────────────────────────────────────────
  {
    id: "sales-history",
    title: "Sales History",
    category: "sales",
    summary: "View, search, and manage all past sales transactions.",
    routes: ["/sales"],
    keywords: ["sales history", "void sale", "receipt", "sale detail", "transactions"],
    tips: [
      {
        title: "Viewing Sale Details",
        body: "Click any sale row to open the detail modal showing all items, customer info, payment type, and totals.",
      },
      {
        title: "Voiding a Sale",
        body: "Use the actions menu (⋮) to void a sale. Voiding sets the status to 'voided' and restores the stock quantities. Voided sales remain in history for audit purposes.",
      },
      {
        title: "Printing Receipts",
        body: "From the sale detail modal, click 'Print Receipt' to generate a printable receipt. The receipt includes store info, items, totals, and payment details.",
      },
    ],
    faq: [
      {
        question: "Can I edit a sale after it's saved?",
        answer: "No. Sales are immutable once recorded. If a mistake was made, void the sale and create a new one.",
      },
      {
        question: "What does voiding do to an installment account?",
        answer: "Voiding a sale with an installment account also voids the account and cancels all pending scheduled payments.",
      },
    ],
  },

  // ── Accounts ───────────────────────────────────────────────────────
  {
    id: "accounts",
    title: "Installment Accounts",
    category: "accounts",
    summary: "Track installment accounts, payment schedules, and outstanding balances.",
    routes: ["/accounts"],
    keywords: ["accounts", "installment", "overdue", "penalty", "defaulted", "balance", "payment schedule"],
    tips: [
      {
        title: "Account Statuses",
        body: "Open = active with payments remaining. Paid = fully settled. Overdue = has missed payments past due date. Defaulted = severely delinquent (set manually).",
      },
      {
        title: "Balance Remaining",
        body: "This is a live running balance. It starts at the total amount owed (principal + interest − down payment) and decreases with each payment received.",
      },
      {
        title: "Penalty System",
        body: "Penalties are automatically detected when overdue payments are found. The system checks on app startup and when you open this page. Penalties add to the balance.",
      },
      {
        title: "Exporting Accounts",
        body: "Use the export button to download the current filtered list as CSV or Excel for external reporting.",
      },
    ],
    faq: [
      {
        question: "How are penalties calculated?",
        answer: "Penalties are a fixed amount or percentage (configured in Settings) applied once per overdue period. The system checks the last penalty date to avoid double-charging.",
      },
      {
        question: "Can I mark an account as defaulted?",
        answer: "Yes. From the account detail page, you can change the status to defaulted for accounts that are severely delinquent.",
      },
      {
        question: "What if the balance seems wrong?",
        answer: "Use the 'Recalculate Balance' action in the account detail page. This rebuilds the balance from scratch based on all recorded payments.",
      },
    ],
  },

  // ── Account Detail ─────────────────────────────────────────────────
  {
    id: "account-detail",
    title: "Account Detail",
    category: "accounts",
    summary: "View and manage a single installment account's schedule and payments.",
    routes: ["/accounts/"],
    keywords: ["account detail", "payment schedule", "record payment", "balance", "installment"],
    tips: [
      {
        title: "Payment Schedule",
        body: "The schedule shows every monthly payment with its due date, amount, and status (paid/pending/overdue). Green rows are paid, red are overdue.",
      },
      {
        title: "Recording a Payment",
        body: "Click 'Record Payment' to log a payment. Enter the amount, date, and optional reference number. The balance and schedule update automatically.",
      },
      {
        title: "Payment History",
        body: "The payment history table shows all payments received for this account, including regular payments, penalties, and advance payments.",
      },
    ],
    faq: [
      {
        question: "Can a customer pay more than one month at a time?",
        answer: "Yes. Enter the total amount and it will be applied to upcoming payments in order. Excess is marked as advance payment.",
      },
      {
        question: "What is a penalty payment?",
        answer: "A penalty payment is an auto-generated charge for overdue payments. It appears in the payment history with type 'penalty'.",
      },
    ],
  },

  // ── Payments ───────────────────────────────────────────────────────
  {
    id: "payments",
    title: "Payments",
    category: "accounts",
    summary: "View all payment transactions across all installment accounts.",
    routes: ["/payments"],
    keywords: ["payments", "payment history", "collections", "payment type", "reference"],
    tips: [
      {
        title: "Payment Types",
        body: "Regular = normal installment payment. Penalty = auto-charged for overdue. Advance = customer paid ahead of schedule. Down Payment = initial payment on an installment sale.",
      },
      {
        title: "Filtering",
        body: "Use the search bar to find payments by customer name or reference number. Filter by payment type or date range for targeted views.",
      },
    ],
    faq: [
      {
        question: "Where do I record a payment?",
        answer: "Payments are recorded from the Account Detail page (click an account, then 'Record Payment'). This page is a read-only ledger of all payments.",
      },
    ],
  },

  // ── Reports ────────────────────────────────────────────────────────
  {
    id: "reports",
    title: "Reports",
    category: "reports",
    summary: "Generate and export business reports across seven categories.",
    routes: ["/reports"],
    keywords: ["reports", "sales summary", "receivables", "inventory", "collections", "customer history", "profit loss", "aging"],
    tips: [
      {
        title: "Report Tabs",
        body: "Switch between Sales Summary, Receivables, Inventory, Collections, Customer History, Profit & Loss, and Aging reports using the tabs at the top.",
      },
      {
        title: "Date Range",
        body: "Some reports (Sales, Collections, Customer History, P&L) support date range filtering. Set the From and To dates, then click Generate.",
      },
      {
        title: "Exporting",
        body: "Each report can be exported as Excel, PDF, or CSV using the export dropdown button.",
      },
      {
        title: "Sales Summary",
        body: "Shows total sales, count, and average per transaction for the selected period. Breaks down by cash vs installment.",
      },
      {
        title: "Aging Report",
        body: "Groups outstanding receivables by how long they've been overdue: Current, 1-30 days, 31-60 days, 61-90 days, and 90+ days.",
      },
      {
        title: "Profit & Loss",
        body: "Summarizes revenue (sales), cost of goods, and gross profit for the selected date range. Useful for monthly/quarterly business review.",
      },
    ],
    faq: [
      {
        question: "What's the difference between Receivables and Aging?",
        answer: "Receivables shows all outstanding account balances. Aging breaks those same balances down by how many days overdue they are.",
      },
      {
        question: "Can I schedule automatic reports?",
        answer: "Not currently. Reports are generated on demand. You can export and save them for your records.",
      },
    ],
  },

  // ── Import / Export ────────────────────────────────────────────────
  {
    id: "import-export",
    title: "Import / Export",
    category: "system",
    summary: "Bulk import products/customers from files or export your data.",
    routes: ["/import-export"],
    keywords: ["import", "export", "csv", "excel", "bulk", "upload", "download"],
    tips: [
      {
        title: "Importing Data",
        body: "Upload a CSV or Excel file to bulk-add products or customers. The system will show a preview of what will be imported before you confirm.",
      },
      {
        title: "Import Format",
        body: "Your file must match the expected column headers. Download a template first to see the exact format required.",
      },
      {
        title: "Exporting Data",
        body: "Export your current products, customers, or sales data as CSV or Excel files for backup or external use.",
      },
    ],
    faq: [
      {
        question: "Will importing overwrite existing data?",
        answer: "No. Imports add new records. Existing records with the same identifier are skipped or updated based on the import mode shown in the preview.",
      },
      {
        question: "What file formats are supported?",
        answer: "CSV (.csv) and Excel (.xlsx) files are supported for both import and export.",
      },
    ],
  },

  // ── Settings ───────────────────────────────────────────────────────
  {
    id: "settings",
    title: "Settings",
    category: "system",
    summary: "Configure store details, categories, database backup, and view audit logs.",
    routes: ["/settings"],
    keywords: ["settings", "categories", "backup", "restore", "audit log", "store name", "configuration"],
    tips: [
      {
        title: "Store Information",
        body: "Set your store name, address, and contact details. These appear on printed receipts and reports.",
      },
      {
        title: "Category Management",
        body: "Create and organize product categories. Categories help you filter and group products in the inventory.",
      },
      {
        title: "Database Backup",
        body: "Creates a complete copy of your database file. Save it to a USB drive or external location. Do this regularly to prevent data loss!",
      },
      {
        title: "Database Restore",
        body: "Replaces your current database with a backup file. Warning: this overwrites all current data. Only use if your current database is corrupted.",
      },
      {
        title: "Audit Log",
        body: "View a chronological log of important actions (sales, payments, stock adjustments) for accountability and troubleshooting.",
      },
    ],
    faq: [
      {
        question: "How often should I back up?",
        answer: "At least once a day, or before and after any large batch of changes (imports, stock adjustments, etc.).",
      },
      {
        question: "Where is my database stored?",
        answer: "On Windows: C:\\Users\\<your name>\\AppData\\Roaming\\quality-appliance\\app.db. The backup creates a copy of this file.",
      },
    ],
  },

  // ── Getting Started ────────────────────────────────────────────────
  {
    id: "getting-started",
    title: "Getting Started",
    category: "getting-started",
    summary: "A quick guide to setting up and using Quality Appliance for the first time.",
    routes: [],
    keywords: ["getting started", "first time", "setup", "how to", "beginner", "tutorial"],
    tips: [
      {
        title: "Step 1: Store Settings",
        body: "Go to Settings and fill in your store name, address, and contact info. This information appears on receipts.",
      },
      {
        title: "Step 2: Add Categories",
        body: "In Settings → Category Management, create categories like 'Refrigerators', 'Washing Machines', 'Air Conditioners'.",
      },
      {
        title: "Step 3: Add Products",
        body: "Go to Inventory → Add Product. Create your products and their variants (sizes, colors). Set prices and initial stock.",
      },
      {
        title: "Step 4: Add Customers",
        body: "Go to Customers → Add Customer for your regular / installment customers. Walk-in cash customers don't need to be registered.",
      },
      {
        title: "Step 5: Make Your First Sale",
        body: "Go to New Sale, search for a product, select the customer, choose cash or installment, and save. That's it!",
      },
      {
        title: "Daily Routine",
        body: "Check the Dashboard each morning for overdue accounts and low stock alerts. Record payments as they come in. Back up your database at end of day.",
      },
    ],
    faq: [
      {
        question: "Do I need internet?",
        answer: "No. Quality Appliance runs entirely offline. All data is stored locally on this computer.",
      },
      {
        question: "Can multiple people use it at the same time?",
        answer: "The app is designed for single-user operation on one computer. Multiple simultaneous users are not supported.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// First-Time Page Hints
// ---------------------------------------------------------------------------

export const firstTimeHints: FirstTimeHint[] = [
  {
    route: "/dashboard",
    title: "Welcome to your Dashboard!",
    tips: [
      "The cards at the top show your key business metrics at a glance.",
      "Click the red/orange badges to jump directly to overdue accounts or low stock items.",
      "Use the chart time range buttons (7d, 30d, etc.) to adjust the view.",
    ],
  },
  {
    route: "/inventory",
    title: "Managing Your Inventory",
    tips: [
      "Click '+ Add Product' to start adding your appliances and their variants.",
      "Each variant (color, size) tracks its own stock level and price.",
      "Use the search bar and category filter to find products quickly.",
    ],
  },
  {
    route: "/customers",
    title: "Customer Management",
    tips: [
      "Add customers here before creating installment sales for them.",
      "Click a customer's name to view their full purchase and account history.",
    ],
  },
  {
    route: "/sales/new",
    title: "Creating a New Sale",
    tips: [
      "Search for products, set quantities, then choose Cash or Installment payment.",
      "For installments, configure the down payment, interest rate, and term months.",
      "Always preview the payment schedule before saving an installment sale.",
    ],
  },
  {
    route: "/sales",
    title: "Sales History",
    tips: [
      "All your completed sales appear here. Click any row for full details.",
      "Use the actions menu (⋮) to void a sale if needed — stock will be restored.",
    ],
  },
  {
    route: "/accounts",
    title: "Installment Accounts",
    tips: [
      "This page shows all installment accounts and their payment status.",
      "Overdue accounts are highlighted — penalties may be auto-applied.",
      "Click an account to view its schedule and record payments.",
    ],
  },
  {
    route: "/payments",
    title: "Payment Ledger",
    tips: [
      "View all payment transactions across every installment account.",
      "Filter by type (regular, penalty, advance) to find specific transactions.",
    ],
  },
  {
    route: "/reports",
    title: "Business Reports",
    tips: [
      "Switch between 7 report types using the tabs at the top.",
      "Set date ranges for time-based reports, then click Generate.",
      "Export any report as Excel, PDF, or CSV for your records.",
    ],
  },
  {
    route: "/import-export",
    title: "Import & Export Data",
    tips: [
      "Import products or customers in bulk from CSV or Excel files.",
      "Download a template first to see the required format.",
      "Export your current data anytime for backup or external reporting.",
    ],
  },
  {
    route: "/settings",
    title: "App Settings",
    tips: [
      "Set your store name and address — these appear on receipts.",
      "Back up your database regularly to prevent data loss!",
      "Manage product categories and review the audit log here.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup Helpers
// ---------------------------------------------------------------------------

/** Find articles applicable to a given route path */
export function getArticlesForRoute(pathname: string): HelpArticle[] {
  return helpArticles.filter((a) =>
    a.routes.some((r) => {
      if (r.endsWith("/")) return pathname.startsWith(r);
      return pathname === r || pathname.startsWith(r + "/");
    })
  );
}

/** Find the primary article for a route (first match) */
export function getPrimaryArticle(pathname: string): HelpArticle | undefined {
  return getArticlesForRoute(pathname)[0];
}

/** Find the first-time hint for a given route */
export function getFirstTimeHint(pathname: string): FirstTimeHint | undefined {
  return firstTimeHints.find((h) => {
    if (h.route.endsWith("/")) return pathname.startsWith(h.route);
    return pathname === h.route || pathname.startsWith(h.route + "/");
  });
}

/** Search articles by query string */
export function searchArticles(query: string): HelpArticle[] {
  const q = query.toLowerCase().trim();
  if (!q) return helpArticles;
  return helpArticles.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.summary.toLowerCase().includes(q) ||
      a.keywords.some((k) => k.includes(q)) ||
      a.tips.some((t) => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)) ||
      a.faq.some((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q))
  );
}

/** Group articles by category */
export function groupByCategory(articles: HelpArticle[]): Record<string, HelpArticle[]> {
  const groups: Record<string, HelpArticle[]> = {};
  for (const a of articles) {
    if (!groups[a.category]) groups[a.category] = [];
    groups[a.category].push(a);
  }
  return groups;
}

export const categoryLabels: Record<string, string> = {
  "getting-started": "Getting Started",
  sales: "Sales",
  inventory: "Inventory",
  customers: "Customers",
  accounts: "Accounts & Payments",
  reports: "Reports",
  system: "System",
};
