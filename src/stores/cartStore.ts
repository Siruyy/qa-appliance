import { create } from "zustand";
import type { CartItem, PaymentType, CreateInstallmentPayload, DiscountType } from "@/types/sale";

interface CartState {
  items: CartItem[];
  customerId: number | null;
  customerName: string;
  discount: number;
  discountType: DiscountType;
  discountValue: number;
  paymentType: PaymentType;
  notes: string;
  installment: CreateInstallmentPayload | null;
}

interface CartStore {
  cart: CartState;
  addToCart: (item: CartItem) => void;
  updateCartQty: (variantId: number, qty: number) => void;
  removeFromCart: (variantId: number) => void;
  clearCart: () => void;
  setCartCustomer: (id: number | null, name: string) => void;
  setCartDiscount: (value: number, type?: DiscountType) => void;
  setCartPaymentType: (type: PaymentType) => void;
  setCartNotes: (notes: string) => void;
  setCartInstallment: (config: CreateInstallmentPayload | null) => void;
  setItemDiscount: (variantId: number, value: number, type: DiscountType) => void;
  cartSubtotal: () => number;
  cartTotal: () => number;
  resolvedDiscount: () => number;
}

const defaultCart: CartState = {
  items: [],
  customerId: null,
  customerName: "",
  discount: 0,
  discountType: "peso",
  discountValue: 0,
  paymentType: "cash",
  notes: "",
  installment: null,
};

/** Recalculate item subtotal accounting for per-item discount. */
function calcItemSubtotal(item: CartItem): number {
  const lineTotal = item.unit_price * item.quantity;
  const disc = item.item_discount_type === "percent"
    ? Math.round(lineTotal * item.item_discount_value / 100 * 100) / 100
    : item.item_discount_value;
  return lineTotal - disc;
}

/** Zustand store for the POS cart (new sale workflow). */
export const useCartStore = create<CartStore>((set, get) => ({
  cart: { ...defaultCart },

  /** Add an item to the POS cart, stacking quantity if variant already exists. */
  addToCart: (item) =>
    set((state) => {
      const newItem = { ...item, item_discount_type: item.item_discount_type ?? "peso" as DiscountType, item_discount_value: item.item_discount_value ?? 0, item_discount: item.item_discount ?? 0 };
      newItem.subtotal = calcItemSubtotal(newItem);
      const existing = state.cart.items.find((i) => i.variant_id === newItem.variant_id);
      if (existing) {
        return {
          cart: {
            ...state.cart,
            items: state.cart.items.map((i: CartItem) => {
              if (i.variant_id !== newItem.variant_id) return i;
              const updated = { ...i, quantity: i.quantity + newItem.quantity };
              updated.subtotal = calcItemSubtotal(updated);
              return updated;
            }),
          },
        };
      }
      return { cart: { ...state.cart, items: [...state.cart.items, newItem] } };
    }),

  /** Update the quantity of a cart item by variant ID. */
  updateCartQty: (variantId, qty) =>
    set((state) => ({
      cart: {
        ...state.cart,
        items: state.cart.items.map((i: CartItem) => {
          if (i.variant_id !== variantId) return i;
          const updated = { ...i, quantity: qty };
          updated.subtotal = calcItemSubtotal(updated);
          return updated;
        }),
      },
    })),

  /** Remove an item from the cart by variant ID. */
  removeFromCart: (variantId) =>
    set((state) => ({
      cart: {
        ...state.cart,
        items: state.cart.items.filter((i: CartItem) => i.variant_id !== variantId),
      },
    })),

  /** Reset the cart to its empty default state. */
  clearCart: () => set({ cart: { ...defaultCart } }),

  /** Set the customer for the current cart. */
  setCartCustomer: (id, name) =>
    set((state) => ({ cart: { ...state.cart, customerId: id, customerName: name } })),

  /** Set a discount on the current cart with optional type toggle. */
  setCartDiscount: (value, type_) =>
    set((state) => ({
      cart: {
        ...state.cart,
        discountValue: value,
        discountType: type_ ?? state.cart.discountType,
        discount: value, // backward compat — resolved in cartTotal/resolvedDiscount
      },
    })),

  /** Set payment type; clears installment config when switching to cash. */
  setCartPaymentType: (type_) =>
    set((state) => ({
      cart: {
        ...state.cart,
        paymentType: type_,
        installment: type_ === "cash" ? null : state.cart.installment,
      },
    })),

  /** Set notes on the current cart. */
  setCartNotes: (notes) =>
    set((state) => ({ cart: { ...state.cart, notes } })),

  /** Set installment configuration for the current cart. */
  setCartInstallment: (config) =>
    set((state) => ({ cart: { ...state.cart, installment: config } })),

  /** Set per-item discount on a specific cart item. */
  setItemDiscount: (variantId, value, type_) =>
    set((state) => ({
      cart: {
        ...state.cart,
        items: state.cart.items.map((i: CartItem) => {
          if (i.variant_id !== variantId) return i;
          const lineTotal = i.unit_price * i.quantity;
          const disc = type_ === "percent"
            ? Math.round(lineTotal * value / 100 * 100) / 100
            : value;
          return { ...i, item_discount_type: type_, item_discount_value: value, item_discount: disc, subtotal: lineTotal - disc };
        }),
      },
    })),

  /** Compute the cart subtotal (after per-item discounts, before sale discount). */
  cartSubtotal: () => get().cart.items.reduce((sum, i) => sum + i.subtotal, 0),

  /** Resolve the sale-level discount to a peso amount. */
  resolvedDiscount: () => {
    const { discountType, discountValue } = get().cart;
    if (discountType === "percent") {
      const subtotal = get().cart.items.reduce((sum, i) => sum + i.subtotal, 0);
      return Math.round(subtotal * discountValue / 100 * 100) / 100;
    }
    return discountValue;
  },

  /** Compute the cart total after all discounts. */
  cartTotal: () => {
    const subtotal = get().cart.items.reduce((sum, i) => sum + i.subtotal, 0);
    const { discountType, discountValue } = get().cart;
    const resolved = discountType === "percent"
      ? Math.round(subtotal * discountValue / 100 * 100) / 100
      : discountValue;
    return subtotal - resolved;
  },
}));
