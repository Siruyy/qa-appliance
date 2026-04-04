# Quality Appliance — UI Design System

## Design Philosophy

- **Business-first, not flashy** — Data density matters more than visual flair
- **Clarity over cleverness** — Staff should be able to find things in under 2 seconds
- **Status at a glance** — Overdue, paid, low stock visible without reading
- **Consistent patterns** — Same table style, same form layout, same modal structure everywhere

---

## Layout

### App Shell

```
┌─────────────────────────────────────────────────────┐
│  [Logo] Quality Appliance       [Date] [Settings⚙]  │  ← TopBar (56px)
├────────────┬────────────────────────────────────────┤
│            │                                         │
│  Sidebar   │         Main Content Area               │
│  (240px)   │         (fluid)                         │
│            │                                         │
│  [Nav      │                                         │
│   Items]   │                                         │
│            │                                         │
│            │                                         │
└────────────┴────────────────────────────────────────┘
```

- Sidebar is **fixed** (always visible) — no collapse on desktop
- Main content area has max-width `1400px` centered with horizontal padding
- Page title shown in TopBar, not repeated in content

### Content Page Structure

```
[Page Title + Subtitle]          [Action Buttons (right-aligned)]
─────────────────────────────────────────────────────────────
[Filter Bar / Search]
─────────────────────────────────────────────────────────────
[Data Table or Content]
─────────────────────────────────────────────────────────────
[Pagination (if needed)]
```

---

## Color Palette

Design language: **Clean professional with strong status signaling**

### Core Colors (CSS Custom Properties)

```css
/* Brand */
--color-primary:         #2563EB;   /* Blue 600 — actions, links, active state */
--color-primary-hover:   #1D4ED8;   /* Blue 700 */
--color-primary-light:   #EFF6FF;   /* Blue 50 — hover backgrounds */

/* Neutral (backgrounds and text) */
--color-bg:              #F9FAFB;   /* Gray 50 — app background */
--color-surface:         #FFFFFF;   /* White — cards, tables */
--color-border:          #E5E7EB;   /* Gray 200 — dividers, borders */
--color-text-primary:    #111827;   /* Gray 900 — headings, labels */
--color-text-secondary:  #6B7280;   /* Gray 500 — subtitles, hints */
--color-text-muted:      #9CA3AF;   /* Gray 400 — placeholders */

/* Sidebar */
--color-sidebar-bg:      #1E293B;   /* Slate 800 — dark sidebar */
--color-sidebar-text:    #CBD5E1;   /* Slate 300 — nav item text */
--color-sidebar-active:  #2563EB;   /* Blue 600 — active nav item bg */
--color-sidebar-hover:   #334155;   /* Slate 700 — nav item hover */

/* Status — Semantic */
--color-success:         #16A34A;   /* Green 600 — paid, in stock */
--color-success-bg:      #F0FDF4;   /* Green 50 — success badge bg */
--color-warning:         #D97706;   /* Amber 600 — partial, low stock */
--color-warning-bg:      #FFFBEB;   /* Amber 50 — warning badge bg */
--color-danger:          #DC2626;   /* Red 600 — overdue, voided */
--color-danger-bg:       #FEF2F2;   /* Red 50 — danger badge bg */
--color-info:            #0284C7;   /* Sky 600 — pending, informational */
--color-info-bg:         #F0F9FF;   /* Sky 50 — info badge bg */
```

---

## Typography

**Font:** `Inter` (Google Fonts CDN or bundled)
- Clean, highly legible at all sizes
- Excellent number rendering (important for financial data)
- Professional without being corporate-sterile

```css
/* Font scale */
--text-xs:    12px;  /* Table metadata, timestamps */
--text-sm:    13px;  /* Table data, labels */
--text-base:  14px;  /* Body copy, form inputs */
--text-md:    15px;  /* Section headings */
--text-lg:    18px;  /* Page titles */
--text-xl:    22px;  /* Dashboard KPI values */
--text-2xl:   28px;  /* Large KPI numbers */

/* Weights */
--font-normal:   400;
--font-medium:   500;
--font-semibold: 600;
--font-bold:     700;
```

### Currency Display
All currency values use tabular numbers and right-alignment:
```css
.currency {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

---

## Status Badges

Consistent badge component for all status indicators:

| Status | Text | Background | Border |
|--------|------|-----------|--------|
| `paid` | Green 700 | Green 50 | Green 200 |
| `pending` | Sky 700 | Sky 50 | Sky 200 |
| `partial` | Amber 700 | Amber 50 | Amber 200 |
| `overdue` | Red 700 | Red 50 | Red 200 |
| `defaulted` | Red 900 | Red 100 | Red 300 |
| `completed` | Green 700 | Green 50 | Green 200 |
| `voided` | Gray 500 | Gray 100 | Gray 300 |
| `open` | Sky 700 | Sky 50 | Sky 200 |
| `low stock` | Amber 700 | Amber 50 | Amber 200 |
| `out of stock` | Red 700 | Red 50 | Red 200 |

---

## Navigation (Sidebar)

```
┌──────────────────────┐
│  ◈ Quality Appliance │  ← Logo/brand (24px font)
│                      │
│  ─── MAIN ────────── │
│  ⊞  Dashboard        │
│  ◻  Inventory        │
│  ◇  Customers        │
│  ◈  New Sale         │  ← Highlighted (primary action)
│  ◎  Accounts         │
│  ○  Payments         │
│  ◫  Reports          │
│                      │
│  ─── SYSTEM ──────── │
│  ⇅  Import / Export  │
│  ⚙  Settings         │
└──────────────────────┘
```

- Active item: `--color-sidebar-active` background + white text + left border accent (3px)
- Hover: `--color-sidebar-hover` background
- "New Sale" is visually distinguished — slightly brighter or with a subtle accent
- Icons: Lucide React (consistent icon set, same as shadcn/ui)

---

## Component Guidelines

### Data Tables

- Alternating row colors (white / gray-25)
- Sticky header
- Column headers sortable (click to sort) with sort indicator arrow
- Right-aligned numeric columns (qty, amount, balance)
- Status badge in its own column
- Row hover: light blue-gray tint
- Action buttons: appear on row hover (Edit, View, Delete icons)
- Empty state: centered illustration + message + CTA button

```
┌──────────────────────────────────────────────────────────────┐
│  Customer        Phone         Balance       Status   Action  │
├──────────────────────────────────────────────────────────────┤
│  Maria Santos    09171234567   ₱ 12,500.00   [OVERDUE]  ⋯   │
│  Juan dela Cruz  09281234567   ₱  5,200.00   [PENDING]  ⋯   │
│  Ana Reyes       09391234567   ₱     0.00    [PAID]     ⋯   │
└──────────────────────────────────────────────────────────────┘
```

### Forms / Modals

- Modal width: 560px (standard), 720px (complex forms like New Sale)
- Label above input (not placeholder-as-label)
- Required fields marked with red asterisk `*`
- Error message appears below the field in red
- Currency inputs show `₱` prefix
- Number inputs right-aligned
- Confirm/Submit = primary blue button (right)
- Cancel = ghost button (left)

### KPI Cards (Dashboard)

```
┌────────────────────────┐
│  Total Sales Today     │
│                        │
│  ₱ 48,500.00           │  ← large number
│                        │
│  ↑ 12% vs yesterday    │  ← trend indicator (green/red)
└────────────────────────┘
```

- 4 cards in a row on desktop
- Border-left accent (4px) in the relevant semantic color
- Value: `--text-2xl`, bold
- Label: `--text-sm`, muted

### Alert Banners

- Overdue accounts banner at top of Accounts page: red background, number of overdue accounts
- Low stock banner at top of Inventory page: amber background, products near zero

---

## Responsive Behavior

Target: **Desktop only** (Windows laptop, minimum 1280px width)

- Layout does not need to be mobile-responsive
- Minimum viable width: 1024px (compressed sidebar)
- Tables can scroll horizontally within their container
- Modals centered with backdrop

---

## Accessibility Baseline

- All interactive elements keyboard-focusable
- Focus rings visible (do not remove outline)
- Color is never the ONLY indicator of meaning (always paired with text or icon)
- Form fields have associated labels
- Minimum touch/click target: 36px height
- ARIA labels on icon-only buttons

---

## Icon Library

**Lucide React** — same library used by shadcn/ui

Key icons used:
| Context | Icon |
|---------|------|
| Dashboard | `LayoutDashboard` |
| Inventory | `Package` |
| Customers | `Users` |
| New Sale | `ShoppingCart` |
| Accounts | `CreditCard` |
| Payments | `Banknote` |
| Reports | `BarChart2` |
| Import/Export | `ArrowUpDown` |
| Settings | `Settings` |
| Overdue | `AlertCircle` |
| Success/Paid | `CheckCircle2` |
| Low stock | `AlertTriangle` |
| Edit | `Pencil` |
| Delete | `Trash2` |
| View | `Eye` |
| Export | `Download` |
| Import | `Upload` |
| Add | `Plus` |
| Search | `Search` |
