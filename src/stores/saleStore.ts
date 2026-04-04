import { create } from "zustand";
import type { Sale, CartItem, PaymentType, CreateInstallmentPayload } from "@/types/sale";

interface SaleFilters {
  search: string;
  paymentType: "all" | "cash" | "installment";
  dateFrom: string;
  dateTo: string;
  includeVoided: boolean;
}

interface CartState {
  items: CartItem[];
  customerId: number | null;
  customerName: string;
  discount: number;
  paymentType: PaymentType;
  notes: string;
  installment: CreateInstallmentPayload | null;
}

interface SaleState {
  // Sales list
  sales: Sale[];
  loading: boolean;
  filters: SaleFilters;
  setSales: (sales: Sale[]) => void;
  setLoading: (loading: boolean) => void;
  setFilter: <K extends keyof SaleFilters>(key: K, value: SaleFilters[K]) => void;
  resetFilters: () => void;
  filteredSales: () => Sale[];

  // Cart (new sale)
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

const defaultFilters: SaleFilters = {
  search: "",
  paymentType: "all",
  dateFrom: "",
  dateTo: "",
  includeVoided: false,
};

const defaultCart: CartState = {
  items: [],
  customerId: null,
  customerName: "",
  discount: 0,
  paymentType: "cash",
  notes: "",
  installment: null,
};

export const useSaleStore = create<SaleState>((set, get) => ({
  sales: [],
  loading: false,
  filters: { ...defaultFilters },

  setSales: (sales) => set({ sales }),
  setLoading: (loading) => set({ loading }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),

  filteredSales: () => {
    const { sales, filters } = get();
    return sales.filter((s) => {
      if (filters.paymentType !== "all" && s.payment_type !== filters.paymentType) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !s.customer_name?.toLowerCase().includes(q) &&
          !String(s.id).includes(q)
        )
          return false;
      }
      return true;
    });
  },

  // Cart
  cart: { ...defaultCart },

  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.items.find((i) => i.variant_id === item.variant_id);
      if (existing) {
        return {
          cart: {
            ...state.cart,
            items: state.cart.items.map((i) =>
              i.variant_id === item.variant_id
                ? { ...i, quantity: i.quantity + item.quantity, subtotal: (i.quantity + item.quantity) * i.unit_price }
                : i
            ),
          },
        };
      }
      return { cart: { ...state.cart, items: [...state.cart.items, item] } };
    }),

  updateCartQty: (variantId, qty) =>
    set((state) => ({
      cart: {
        ...state.cart,
        items: state.cart.items.map((i) =>
          i.variant_id === variantId
            ? { ...i, quantity: qty, subtotal: qty * i.unit_price }
            : i
        ),
      },
    })),

  removeFromCart: (variantId) =>
    set((state) => ({
      cart: {
        ...state.cart,
        items: state.cart.items.filter((i) => i.variant_id !== variantId),
      },
    })),

  clearCart: () => set({ cart: { ...defaultCart } }),

  setCartCustomer: (id, name) =>
    set((state) => ({ cart: { ...state.cart, customerId: id, customerName: name } })),

  setCartDiscount: (discount) =>
    set((state) => ({ cart: { ...state.cart, discount } })),

  setCartPaymentType: (type_) =>
    set((state) => ({
      cart: {
        ...state.cart,
        paymentType: type_,
        installment: type_ === "cash" ? null : state.cart.installment,
      },
    })),

  setCartNotes: (notes) =>
    set((state) => ({ cart: { ...state.cart, notes } })),

  setCartInstallment: (config) =>
    set((state) => ({ cart: { ...state.cart, installment: config } })),

  cartSubtotal: () => get().cart.items.reduce((sum, i) => sum + i.subtotal, 0),
  cartTotal: () => get().cartSubtotal() - get().cart.discount,
}));

