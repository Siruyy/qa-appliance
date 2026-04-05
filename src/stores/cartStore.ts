import { create } from "zustand";
import type { CartItem, PaymentType, CreateInstallmentPayload } from "@/types/sale";

interface CartState {
  items: CartItem[];
  customerId: number | null;
  customerName: string;
  discount: number;
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
  setCartDiscount: (discount: number) => void;
  setCartPaymentType: (type: PaymentType) => void;
  setCartNotes: (notes: string) => void;
  setCartInstallment: (config: CreateInstallmentPayload | null) => void;
  cartSubtotal: () => number;
  cartTotal: () => number;
}

const defaultCart: CartState = {
  items: [],
  customerId: null,
  customerName: "",
  discount: 0,
  paymentType: "cash",
  notes: "",
  installment: null,
};

/** Zustand store for the POS cart (new sale workflow). */
export const useCartStore = create<CartStore>((set, get) => ({
  cart: { ...defaultCart },

  /** Add an item to the POS cart, stacking quantity if variant already exists. */
  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.items.find((i) => i.variant_id === item.variant_id);
      if (existing) {
        return {
          cart: {
            ...state.cart,
            items: state.cart.items.map((i: CartItem) =>
              i.variant_id === item.variant_id
                ? { ...i, quantity: i.quantity + item.quantity, subtotal: (i.quantity + item.quantity) * i.unit_price }
                : i
            ),
          },
        };
      }
      return { cart: { ...state.cart, items: [...state.cart.items, item] } };
    }),

  /** Update the quantity of a cart item by variant ID. */
  updateCartQty: (variantId, qty) =>
    set((state) => ({
      cart: {
        ...state.cart,
        items: state.cart.items.map((i: CartItem) =>
          i.variant_id === variantId
            ? { ...i, quantity: qty, subtotal: qty * i.unit_price }
            : i
        ),
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

  /** Set a discount amount on the current cart. */
  setCartDiscount: (discount) =>
    set((state) => ({ cart: { ...state.cart, discount } })),

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

  /** Compute the cart subtotal before discount. */
  cartSubtotal: () => get().cart.items.reduce((sum, i) => sum + i.subtotal, 0),

  /** Compute the cart total after discount. */
  cartTotal: () => {
    const subtotal = get().cart.items.reduce((sum, i) => sum + i.subtotal, 0);
    return subtotal - get().cart.discount;
  },
}));
