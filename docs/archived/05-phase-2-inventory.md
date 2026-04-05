# Phase 2 — Inventory Module

## Goal
Full CRUD for categories, products, and product variants. Staff can add new appliances, update stock quantities, set prices, and archive discontinued products.

---

## Screen: Inventory Page (`/inventory`)

### Layout
```
[Inventory]                                  [+ Add Product]
──────────────────────────────────────────────────────────────
[Search: product name...]  [Category ▾]  [Status: Active ▾]
──────────────────────────────────────────────────────────────
[Products Table]
  Name | Category | Variants | Total Stock | Price Range | Status | Actions
──────────────────────────────────────────────────────────────
[Expandable rows → show variant details inline]
```

### Behavior Details
- Clicking a product row expands to show its variants inline
- Each variant row shows: attributes, SKU, cost, selling price, stock qty, low stock badge if applicable
- "Out of stock" badge when `stock_qty = 0`
- "Low stock" badge when `stock_qty <= low_stock_threshold`
- Category filter is a dropdown populated from the `categories` table
- Status filter: Active / Archived / All

---

## TypeScript Types (`src/types/product.ts`)

- [x] Define the following interfaces:
  - Category, Product, ProductVariant, CreateProductPayload, UpdateProductPayload, CreateVariantPayload, UpdateVariantPayload
  - *Implementation note: Used explicit interfaces instead of Omit/Partial for clarity. `product_name` optional field on variant for display.*

---

## Zod Validation Schemas (`src/lib/validations/product.ts`)

- [x] `categorySchema`:
  - `name`: required, min 1, max 100, trimmed
- [x] `productSchema`:
  - `category_id`: required integer
  - `name`: required, min 1, max 200, trimmed
  - `description`: optional string
- [x] `variantSchema`:
  - `product_id`: required integer
  - `attributes`: array of {key, value} pairs (1-5), converted to Record on submit
  - `cost_price`: required number ≥ 0
  - `selling_price`: required number ≥ 0
  - `stock_qty`: required integer ≥ 0
  - `low_stock_threshold`: required integer ≥ 0
  - `sku`: optional string
  - *Note: Uses Zod v4 syntax (`{ error: "..." }` not `{ required_error }`)*

---

## Rust: Models (`src-tauri/src/models/product.rs`)

- [x] Define `Category`, `Product`, `ProductVariant` structs matching DB schema
- [x] All structs derive `Debug, Serialize, Deserialize, Clone`
- [x] `ProductVariant.attributes` serialized as `Option<serde_json::Value>` in Rust
- [x] Define `CreateProductPayload`, `UpdateProductPayload`, `CreateVariantPayload`, `UpdateVariantPayload` structs

---

## Rust: Commands (`src-tauri/src/commands/products.rs`)

### Category Commands
- [x] `get_categories() → Vec<Category>`
- [x] `create_category(name, description) → Category`
- [x] `update_category(id, name, description) → Category`
- [x] `delete_category(id) → Result<(), String>` — rejects if products reference it

### Product Commands
- [x] `get_products() → Vec<Product>` — joins categories + loads all variants
- [x] `get_product_by_id(id) → Product`
- [x] `create_product(payload) → Product`
- [x] `update_product(payload) → Product` — dynamic UPDATE for partial updates
- [x] `archive_product(id) → ()` — cascades to variants
- [x] `restore_product(id) → ()` — cascades to variants

### Variant Commands
- [x] `get_variants_for_product(product_id) → Vec<ProductVariant>`
- [x] `create_variant(payload) → ProductVariant`
- [x] `update_variant(payload) → ProductVariant` — dynamic UPDATE for partial updates
- [x] `archive_variant(id) → ()`
- [x] `adjust_stock(id, delta) → ProductVariant` — validates qty never goes below 0

---

## Rust: Register Commands in `lib.rs`

- [x] All 16 commands registered in `invoke_handler` (4 category + 6 product + 6 variant)

---

## Frontend: Hooks (`src/hooks/useProducts.ts`, `src/hooks/useCategories.ts`)

- [x] `useProducts()` — fetch on mount, create/update/archive/restore + variant ops, auto-refetch
- [x] `useCategories()` — fetch on mount, create/update/delete, auto-refetch

---

## Frontend: Store (`src/stores/productStore.ts`)

- [x] State: products, categories, loading, filters (search, categoryId, status)
- [x] Actions: setProducts, setCategories, setLoading, setFilter, resetFilters
- [x] `filteredProducts()` selector — search + category + active/archived filter

---

## Frontend: Pages & Components

### InventoryPage (`src/pages/inventory/InventoryPage.tsx`)
- [x] Filter bar: search input, category dropdown, status dropdown (Active/Archived/All)
- [x] Products table with expandable variant sub-rows
- [x] "+ Add Product" button opens ProductFormModal
- [x] Product actions: Edit, Add Variant, Archive/Restore
- [x] Variant actions: Edit, Adjust Stock, Archive
- [x] Low stock (warning) / Out of stock (destructive) badges
- [x] Empty state with Package icon

### ProductFormModal (`src/pages/inventory/ProductFormModal.tsx`)
- [x] Create and Edit mode (determined by `product` prop)
- [x] Fields: Category dropdown, Name, Description
- [x] Zod validation, toast on success/error

### VariantFormModal (`src/pages/inventory/VariantFormModal.tsx`)
- [x] Create and Edit mode
- [x] Dynamic key-value attributes (1-5 pairs) with useFieldArray
- [x] Fields: SKU, Cost Price, Selling Price, Stock Qty, Low Stock Threshold
- [x] Converts array ↔ Record<string,string> on load/save

### StockAdjustModal (`src/pages/inventory/StockAdjustModal.tsx`)
- [x] +/- delta with increment/decrement buttons
- [x] Shows current qty and projected new qty
- [x] Validates new qty ≥ 0

### CategoryManagement (`src/pages/settings/CategoryManagement.tsx`)
- [x] Inline add/edit/delete in Settings page
- [x] Zod-validated form row
- [x] Delete guard handled by Rust backend

---

## Phase 2 Sign-off Checklist

- [x] Can create a category
- [x] Can create a product under a category
- [x] Can add multiple variants to a product with different colors/attributes
- [x] Stock qty decrements correctly with `adjust_stock`
- [x] Low stock badge appears when qty ≤ threshold
- [x] Archiving a product hides it from the active list
- [x] Search filters products by name in real time
- [x] Category dropdown filter works correctly
- [x] No TypeScript errors
- [x] All Zod validations trigger appropriate error messages on the form
