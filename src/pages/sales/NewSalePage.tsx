import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams, useBlocker } from "react-router-dom";
import { ShoppingCart, User, Banknote, CreditCard, Loader2 } from "lucide-react";
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
import { parseSettings } from "@/types/settings";
import { calculateAddOnInterest, generatePaymentSchedule } from "@/lib/interest";
import type { CartItem, CreateInstallmentPayload, PaymentType } from "@/types/sale";
import type { Customer } from "@/types/customer";
import { getErrorWithRecovery } from "@/lib/error";
import { useCartStore } from "@/stores/cartStore";
import { useCustomerStore } from "@/stores/customerStore";
import { useProducts } from "@/hooks/useProducts";
import { useCustomers } from "@/hooks/useCustomers";
import { useSales } from "@/hooks/useSales";
import { HelpTip } from "@/components/help/HelpTip";
import { FirstTimeHint } from "@/components/help/FirstTimeHint";
import { ProductSearchDropdown } from "./ProductSearchDropdown";
import { SaleItemRow } from "./SaleItemRow";
import { InstallmentConfigPanel } from "./InstallmentConfigPanel";
import { PaymentSchedulePreviewModal } from "./PaymentSchedulePreviewModal";

export function NewSalePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createSale } = useSales();
  const { fetchProducts } = useProducts();
  const { fetchCustomers } = useCustomers();
  const customers = useCustomerStore((s) => s.customers);
  const settings = useSettingsStore((s) => s.settings);
  const typed = useMemo(() => parseSettings(settings), [settings]);

  const defaultInstallment = useMemo<CreateInstallmentPayload>(() => ({
    down_payment: 0,
    interest_rate: typed.default_interest_rate,
    penalty_rate: typed.default_penalty_rate,
    term_months: typed.default_installment_term,
    start_date: new Date().toISOString().split("T")[0],
    rebate_rate: typed.rebate_enabled ? typed.default_rebate_rate : 0,
    interest_type: "monthly",
  }), [typed.default_interest_rate, typed.default_penalty_rate, typed.default_installment_term, typed.rebate_enabled, typed.default_rebate_rate]);

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
    setItemDiscount,
    cartSubtotal,
    cartTotal,
    resolvedDiscount,
  } = useCartStore();

  const [submitting, setSubmitting] = useState(false);
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);

  // Warn before navigating away if the cart has items
  const blocker = useBlocker(() => cart.items.length > 0 && !submitting);

  useEffect(() => {
    if (blocker.state === "blocked") {
      const leave = window.confirm(
        "You have unsaved items in your cart. Are you sure you want to leave?"
      );
      if (leave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, [fetchProducts, fetchCustomers]);

  // Pre-select customer from URL params (e.g., from customer detail page)
  useEffect(() => {
    const preselectedId = searchParams.get("customer_id");
    if (preselectedId && !cart.customerId) {
      const id = Number(preselectedId);
      const cust = customers.find((c) => c.id === id);
      if (cust) {
        setCartCustomer(id, cust.name);
      }
    }
  }, [searchParams, customers, cart.customerId, setCartCustomer]);

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
        item_discount_type: "peso",
        item_discount_value: 0,
        item_discount: 0,
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

  const subtotal = cartSubtotal();
  const total = cartTotal();

  // Schedule preview data
  const schedulePreview = useMemo(() => {
    if (!cart.installment?.term_months || !cart.installment.start_date) {
      return null;
    }
    const principal = total - cart.installment.down_payment;
    if (principal <= 0) return null;
    const { totalPayable, monthlyPayment, principalPerMonth, interestPerMonth } = calculateAddOnInterest(
      principal,
      cart.installment.interest_rate,
      cart.installment.term_months,
      cart.installment.interest_type ?? "monthly"
    );
    const schedule = generatePaymentSchedule(
      monthlyPayment,
      cart.installment.term_months,
      cart.installment.start_date,
      totalPayable,
      principalPerMonth,
      interestPerMonth
    );
    return { schedule, monthlyPayment, totalPayable };
  }, [cart.installment, total]);

  const excludeVariantIds = useMemo(
    () => cart.items.map((i: CartItem) => i.variant_id),
    [cart.items]
  );

  // Submit sale
  const handleSubmit = async () => {
    if (submitting) return;
    if (cart.items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (cart.items.some((i: CartItem) => i.quantity <= 0)) {
      toast.error("All item quantities must be greater than 0");
      return;
    }
    if (cart.discount < 0) {
      toast.error("Discount cannot be negative");
      return;
    }
    if (cart.paymentType === "installment" && !cart.customerId) {
      toast.error("Select a customer for installment sales");
      return;
    }
    if (cart.customerId && !customers.some((c) => c.id === cart.customerId)) {
      toast.error("Selected customer no longer exists. Please reselect.");
      setCartCustomer(null, "");
      return;
    }
    if (total <= 0) {
      toast.error("Sale total must be positive");
      return;
    }
    if (cart.paymentType === "installment" && cart.installment) {
      if (cart.installment.down_payment > total) {
        toast.error("Down payment cannot exceed the sale total");
        return;
      }
    }

    setSubmitting(true);
    try {
      const saleId = await createSale({
        customer_id: cart.customerId,
        payment_type: cart.paymentType,
        discount: resolvedDiscount(),
        discount_type: cart.discountType,
        discount_value: cart.discountValue,
        notes: cart.notes || null,
        items: cart.items.map((i: CartItem) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          item_discount_type: i.item_discount_type,
          item_discount_value: i.item_discount_value,
        })),
        installment: cart.paymentType === "installment" ? cart.installment ?? undefined : undefined,
      });

      if (saleId) {
        toast.success("Sale recorded successfully");
        clearCart();
        await fetchProducts();
        navigate("/sales");
      }
    } catch (err) {
      toast.error(getErrorWithRecovery(err, "Failed to create sale"));
    } finally {
      setSubmitting(false);
    }
  };

  const { format: formatCurrency } = useCurrency();
  return (
    <div className="space-y-6">
      <FirstTimeHint />
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
                          onSetItemDiscount={setItemDiscount}
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
              rebateEnabled={typed.rebate_enabled}
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
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="w-full justify-start text-left" />
                  }
                >
                    {cart.customerName || (
                      <span className="text-muted-foreground">Select customer (optional)...</span>
                    )}
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
                <Label>Payment Type <HelpTip text="Cash: paid in full now. Installment: creates a payment schedule with monthly dues." /></Label>
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
                        <CreditCard className="h-4 w-4" /> Installment
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Discount</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    min={0}
                    step={cart.discountType === "percent" ? 1 : 50}
                    max={cart.discountType === "percent" ? 100 : undefined}
                    value={cart.discountValue || ""}
                    onChange={(e) => setCartDiscount(parseFloat(e.target.value) || 0)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant={cart.discountType === "peso" ? "default" : "outline"}
                    size="sm"
                    className="px-2.5 shrink-0"
                    onClick={() => setCartDiscount(cart.discountValue, "peso")}
                  >
                    ₱
                  </Button>
                  <Button
                    type="button"
                    variant={cart.discountType === "percent" ? "default" : "outline"}
                    size="sm"
                    className="px-2.5 shrink-0"
                    onClick={() => setCartDiscount(cart.discountValue, "percent")}
                  >
                    %
                  </Button>
                </div>
                {cart.discountType === "percent" && cart.discountValue > 0 && (
                  <p className="text-xs text-muted-foreground">
                    = {formatCurrency(resolvedDiscount())}
                  </p>
                )}
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
              {resolvedDiscount() > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Discount{cart.discountType === "percent" ? ` (${cart.discountValue}%)` : ""}
                  </span>
                  <span className="text-destructive">- {formatCurrency(resolvedDiscount())}</span>
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
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                ) : (
                  "Complete Sale"
                )}
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
