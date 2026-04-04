import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, User, Banknote, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/useCurrency";
import { useSettingsStore } from "@/stores/settingsStore";
import { calculateAddOnInterest, generatePaymentSchedule } from "@/lib/interest";
import type { CartItem, CreateInstallmentPayload, PaymentType } from "@/types/sale";
import type { Customer } from "@/types/customer";
import { useSaleStore } from "@/stores/saleStore";
import { useCustomerStore } from "@/stores/customerStore";
import { useProducts } from "@/hooks/useProducts";
import { useCustomers } from "@/hooks/useCustomers";
import { useSales } from "@/hooks/useSales";
import { ProductSearchDropdown } from "./ProductSearchDropdown";
import { SaleItemRow } from "./SaleItemRow";
import { InstallmentConfigPanel } from "./InstallmentConfigPanel";
import { PaymentSchedulePreviewModal } from "./PaymentSchedulePreviewModal";

export function NewSalePage() {
  const navigate = useNavigate();
  const { createSale } = useSales();
  const { fetchProducts } = useProducts();
  const { fetchCustomers } = useCustomers();
  const customers = useCustomerStore((s) => s.customers);
  const settings = useSettingsStore((s) => s.settings);

  const defaultInstallment = useMemo<CreateInstallmentPayload>(() => ({
    down_payment: 0,
    interest_rate: parseFloat(settings.default_interest_rate) || 0,
    penalty_rate: parseFloat(settings.default_penalty_rate) || 0,
    has_schedule: true,
    term_months: parseInt(settings.default_term_months, 10) || 12,
    start_date: new Date().toISOString().split("T")[0],
  }), [settings.default_interest_rate, settings.default_penalty_rate, settings.default_term_months]);

  const {
    cart,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    setCartCustomer,
    setCartDiscount,
    setCartPaymentType,
    setCartNotes,
    setCartInstallment,
    cartSubtotal,
    cartTotal,
  } = useSaleStore();

  const [submitting, setSubmitting] = useState(false);
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, [fetchProducts, fetchCustomers]);

  // Payment type selection
  const handlePaymentTypeChange = useCallback(
    (value: string | null) => {
      if (!value) return;
      const pt = value as PaymentType;
      setCartPaymentType(pt);
      if (pt === "installment" && !cart.installment) {
        setCartInstallment({ ...defaultInstallment });
      }
    },
    [setCartPaymentType, setCartInstallment, cart.installment]
  );

  // Product selected from dropdown
  const handleProductSelect = useCallback(
    (option: { product: { name: string }; variant: { id: number; selling_price: number; stock_qty: number; attributes: Record<string, string> | null } }) => {
      const attrs = option.variant.attributes
        ? Object.values(option.variant.attributes).join(" / ")
        : "";
      const item: CartItem = {
        variant_id: option.variant.id,
        product_name: option.product.name,
        variant_label: attrs,
        quantity: 1,
        unit_price: option.variant.selling_price,
        subtotal: option.variant.selling_price,
        stock_qty: option.variant.stock_qty,
      };
      addToCart(item);
    },
    [addToCart]
  );

  // Customer select
  const handleCustomerSelect = useCallback(
    (customer: Customer) => {
      setCartCustomer(customer.id, customer.name);
      setCustomerSearchOpen(false);
    },
    [setCartCustomer]
  );

  // Schedule preview data
  const schedulePreview = useMemo(() => {
    if (!cart.installment?.has_schedule || !cart.installment.term_months || !cart.installment.start_date) {
      return null;
    }
    const principal = cartTotal() - cart.installment.down_payment;
    if (principal <= 0) return null;
    const { totalPayable, monthlyPayment } = calculateAddOnInterest(
      principal,
      cart.installment.interest_rate,
      cart.installment.term_months
    );
    const schedule = generatePaymentSchedule(
      monthlyPayment,
      cart.installment.term_months,
      cart.installment.start_date
    );
    return { schedule, monthlyPayment, totalPayable };
  }, [cart.installment, cartTotal]);

  const excludeVariantIds = useMemo(
    () => cart.items.map((i) => i.variant_id),
    [cart.items]
  );

  // Submit sale
  const handleSubmit = async () => {
    if (cart.items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (cart.paymentType === "installment" && !cart.customerId) {
      toast.error("Select a customer for installment sales");
      return;
    }
    if (cartTotal() <= 0) {
      toast.error("Sale total must be positive");
      return;
    }

    setSubmitting(true);
    try {
      const saleId = await createSale({
        customer_id: cart.customerId,
        payment_type: cart.paymentType,
        discount: cart.discount,
        notes: cart.notes || null,
        items: cart.items.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        installment: cart.paymentType === "installment" ? cart.installment ?? undefined : undefined,
      });

      if (saleId) {
        clearCart();
        navigate("/sales");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const subtotal = cartSubtotal();
  const total = cartTotal();

  const { format: formatCurrency } = useCurrency();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Sale</h1>
          <p className="text-muted-foreground">Create a new sale transaction</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/sales")}>
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Products & Cart */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" />
                Cart Items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProductSearchDropdown
                onSelect={handleProductSelect}
                excludeVariantIds={excludeVariantIds}
              />

              {cart.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items yet. Search and add products above.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3">Product</th>
                        <th className="text-right py-2 px-3">Price</th>
                        <th className="text-center py-2 px-3 w-[160px]">Qty</th>
                        <th className="text-right py-2 px-3">Subtotal</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.items.map((item) => (
                        <SaleItemRow
                          key={item.variant_id}
                          item={item}
                          onUpdateQty={updateCartQty}
                          onRemove={removeFromCart}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Installment config (shown when payment type is installment) */}
          {cart.paymentType === "installment" && (
            <InstallmentConfigPanel
              saleTotal={total}
              config={cart.installment ?? defaultInstallment}
              onChange={setCartInstallment}
              onPreviewSchedule={() => setShowSchedulePreview(true)}
            />
          )}
        </div>

        {/* Right — Sale Details */}
        <div className="space-y-4">
          {/* Customer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger className="w-full">
                  <Button variant="outline" className="w-full justify-start text-left">
                    {cart.customerName || (
                      <span className="text-muted-foreground">Select customer (optional)...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search customers..." />
                    <CommandList>
                      <CommandEmpty>No customers found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__walk_in__"
                          onSelect={() => {
                            setCartCustomer(null, "");
                            setCustomerSearchOpen(false);
                          }}
                        >
                          <span className="text-muted-foreground">Walk-in (no customer)</span>
                        </CommandItem>
                        {customers
                          .filter((c) => c.is_active)
                          .map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.name} ${c.phone ?? ""}`}
                              onSelect={() => handleCustomerSelect(c)}
                            >
                              <div>
                                <div className="font-medium">{c.name}</div>
                                {c.phone && (
                                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {cart.paymentType === "installment" && !cart.customerId && (
                <p className="text-xs text-destructive mt-1">
                  Customer required for installment sales
                </p>
              )}
            </CardContent>
          </Card>

          {/* Payment Type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Banknote className="h-4 w-4" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Payment Type</Label>
                <Select value={cart.paymentType} onValueChange={handlePaymentTypeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <span className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" /> Cash
                      </span>
                    </SelectItem>
                    <SelectItem value="installment">
                      <span className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" /> Installment (Utang)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Discount (₱)</Label>
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={cart.discount}
                  onChange={(e) => setCartDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  rows={2}
                  placeholder="Optional notes..."
                  value={cart.notes}
                  onChange={(e) => setCartNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Subtotal ({cart.items.length} item{cart.items.length !== 1 ? "s" : ""})
                </span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {cart.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-destructive">- {formatCurrency(cart.discount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>

              <Button
                className="w-full mt-4"
                size="lg"
                onClick={handleSubmit}
                disabled={submitting || cart.items.length === 0}
              >
                {submitting ? "Processing..." : "Complete Sale"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule Preview Modal */}
      {schedulePreview && (
        <PaymentSchedulePreviewModal
          open={showSchedulePreview}
          onOpenChange={setShowSchedulePreview}
          schedule={schedulePreview.schedule}
          monthlyPayment={schedulePreview.monthlyPayment}
          totalPayable={schedulePreview.totalPayable}
        />
      )}
    </div>
  );
}
