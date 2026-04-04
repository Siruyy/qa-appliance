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

- [ ] Define the following interfaces:
  ```typescript
  export interface Category {
    id: number
    name: string
    description: string | null
    created_at: string
    updated_at: string
  }

  export interface ProductVariant {
    id: number
    product_id: number
    sku: string | null
    attributes: Record<string, string> | null  // parsed from JSON
    cost_price: number
    selling_price: number
    stock_qty: number
    low_stock_threshold: number
    is_active: boolean
    created_at: string
    updated_at: string
  }

  export interface Product {
    id: number
    category_id: number
    category_name: string    // joined from categories
    name: string
    description: string | null
    is_active: boolean
    variants: ProductVariant[]
    created_at: string
    updated_at: string
  }

  export type CreateProductPayload = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'variants' | 'category_name'>
  export type UpdateProductPayload = Partial<CreateProductPayload> & { id: number }

  export type CreateVariantPayload = Omit<ProductVariant, 'id' | 'created_at' | 'updated_at'>
  export type UpdateVariantPayload = Partial<CreateVariantPayload> & { id: number }
  ```

---

## Zod Validation Schemas (`src/lib/validations/product.ts`)

- [ ] `categorySchema`:
  - `name`: required, min 1, max 100, trimmed
- [ ] `productSchema`:
  - `category_id`: required integer
  - `name`: required, min 1, max 200, trimmed
  - `description`: optional string
- [ ] `variantSchema`:
  - `product_id`: required integer
  - `attributes`: object with at least one key, all string values
  - `cost_price`: required number ≥ 0
  - `selling_price`: required number ≥ 0
  - `stock_qty`: required integer ≥ 0
  - `low_stock_threshold`: required integer ≥ 0
  - `sku`: optional string

---

## Rust: Models (`src-tauri/src/models/product.rs`)

- [ ] Define `Category`, `Product`, `ProductVariant` structs matching DB schema
- [ ] All structs derive `Debug, Serialize, Deserialize, Clone`
- [ ] `ProductVariant.attributes` serialized as `Option<String>` in Rust (JSON string), deserialized to `serde_json::Value`
- [ ] Define `CreateProductPayload`, `UpdateProductPayload`, `CreateVariantPayload`, `UpdateVariantPayload` structs

---

## Rust: Commands (`src-tauri/src/commands/products.rs`)

### Category Commands
- [ ] `get_categories() → Vec<Category>`
  - `SELECT * FROM categories ORDER BY name`
- [ ] `create_category(name: String, description: Option<String>) → Category`
  - Insert + return new row
- [ ] `update_category(id: i64, name: String) → Category`
- [ ] `delete_category(id: i64) → Result<(), String>`
  - Fail with error message if any product references this category

### Product Commands
- [ ] `get_products(include_archived: bool) → Vec<Product>`
  - JOIN with categories, JOIN with variants
  - Filter by `is_active` based on `include_archived`
- [ ] `get_product_by_id(id: i64) → Product`
- [ ] `create_product(payload: CreateProductPayload) → Product`
- [ ] `update_product(payload: UpdateProductPayload) → Product`
- [ ] `archive_product(id: i64) → ()` — sets `is_active = 0`
- [ ] `restore_product(id: i64) → ()` — sets `is_active = 1`

### Variant Commands
- [ ] `get_variants_for_product(product_id: i64) → Vec<ProductVariant>`
- [ ] `create_variant(payload: CreateVariantPayload) → ProductVariant`
- [ ] `update_variant(payload: UpdateVariantPayload) → ProductVariant`
- [ ] `archive_variant(id: i64) → ()`
- [ ] `adjust_stock(variant_id: i64, delta: i64, reason: String) → ProductVariant`
  - `delta` can be negative (remove) or positive (add)
  - Validates resulting qty never goes below 0

---

## Rust: Register Commands in `main.rs`

- [ ] Add all category, product, and variant commands to `invoke_handler`

---

## Frontend: Hooks (`src/hooks/useProducts.ts`)

- [ ] `useProducts()` hook:
  - Calls `invoke('get_products')` on mount
  - Returns `{ products, categories, isLoading, error, refetch }`
- [ ] `useCategories()` hook:
  - Loads and caches category list

---

## Frontend: Store (`src/stores/productStore.ts`)

- [ ] State:
  - `products: Product[]`
  - `categories: Category[]`
  - `filters: { search: string, categoryId: number | null, showArchived: boolean }`
- [ ] Actions:
  - `setProducts(products: Product[]): void`
  - `setCategories(categories: Category[]): void`
  - `setFilter(key, value): void`
- [ ] Derived (computed via selector):
  - `filteredProducts` — applies search + category + active filter

---

## Frontend: Pages & Components

### InventoryPage (`src/pages/inventory/InventoryPage.tsx`)
- [ ] Render filter bar: search input, category dropdown, status dropdown
- [ ] Render products table with expandable rows
- [ ] "+ Add Product" button opens `ProductFormModal`
- [ ] Each product row has Edit, Archive, "+ Add Variant" actions
- [ ] Each variant row (expanded) has Edit, Archive, "Adjust Stock" actions
- [ ] Low stock / out of stock badges displayed on variant rows
- [ ] Empty state when no products match filters

### ProductFormModal (`src/pages/inventory/ProductFormModal.tsx`)
- [ ] Used for both Create and Edit (controlled by `productId` prop — null = create)
- [ ] Fields: Category (dropdown), Product Name, Description
- [ ] Submit calls `create_product` or `update_product` command
- [ ] On success: closes modal, refetches product list, shows toast

### VariantFormModal (`src/pages/inventory/VariantFormModal.tsx`)
- [ ] Used for both Create and Edit
- [ ] Fields:
  - Attributes (dynamic key-value pairs — up to 5 pairs, e.g., "Color: White")
  - SKU (optional)
  - Cost Price (₱ prefix)
  - Selling Price (₱ prefix)
  - Stock Quantity
  - Low Stock Threshold
- [ ] Submit calls `create_variant` or `update_variant`
- [ ] On success: closes modal, refetches product, shows toast

### StockAdjustModal (inline, small)
- [ ] Input: new quantity or +/- delta mode toggle
- [ ] Calls `adjust_stock` command
- [ ] Shows current qty in modal title

### CategoryManagement (in Settings page, not Inventory)
- [ ] Simple list with Add/Edit/Delete inline

---

## Phase 2 Sign-off Checklist

- [ ] Can create a category
- [ ] Can create a product under a category
- [ ] Can add multiple variants to a product with different colors/attributes
- [ ] Stock qty decrements correctly with `adjust_stock`
- [ ] Low stock badge appears when qty ≤ threshold
- [ ] Archiving a product hides it from the active list
- [ ] Search filters products by name in real time
- [ ] Category dropdown filter works correctly
- [ ] No TypeScript errors
- [ ] All Zod validations trigger appropriate error messages on the form
