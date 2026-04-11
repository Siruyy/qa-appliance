import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { HelpTip } from "@/components/help/HelpTip";
import { useCurrency } from "@/hooks/useCurrency";
import { calculateAddOnInterest } from "@/lib/interest";
import type { CreateInstallmentPayload } from "@/types/sale";
import type { InterestType } from "@/types/account";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

interface InstallmentConfigPanelProps {
  saleTotal: number;
  config: CreateInstallmentPayload;
  onChange: (config: CreateInstallmentPayload) => void;
  onPreviewSchedule: () => void;
  rebateEnabled?: boolean;
}

const PRESET_TERMS = [6, 12, 18, 24] as const;
const PRESET_DOWN_PCT = [0, 10, 20, 30] as const;

export function InstallmentConfigPanel({
  saleTotal,
  config,
  onChange,
  onPreviewSchedule,
  rebateEnabled,
}: InstallmentConfigPanelProps) {
  const principal = saleTotal - config.down_payment;
  const interestType: InterestType = config.interest_type ?? "monthly";

  const interest =
    config.interest_rate > 0 && config.term_months
      ? calculateAddOnInterest(principal, config.interest_rate, config.term_months, interestType)
      : null;

  const computedMonthly =
    config.term_months && config.term_months > 0
      ? interest
        ? interest.monthlyPayment
        : Math.ceil((principal / config.term_months) * 100) / 100
      : null;

  const INTEREST_TYPE_OPTIONS: { value: InterestType; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "annual", label: "Annual" },
    { value: "flat_total", label: "Flat Total" },
  ];

  const rateLabel =
    interestType === "monthly"
      ? "% / month"
      : interestType === "annual"
        ? "% p.a."
        : "% (one-time)";

  // Interest section is off by default
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Reset interest_rate to 0 when collapsing, so it doesn't silently charge interest
  const toggleAdvanced = () => {
    if (showAdvanced) {
      onChange({ ...config, interest_rate: 0 });
    }
    setShowAdvanced((v) => !v);
  };

  // Monthly payment override: null = use computed
  const isOverridden = config.monthly_payment_override != null && config.monthly_payment_override > 0;
  const displayedMonthly = isOverridden ? config.monthly_payment_override! : (computedMonthly ?? 0);

  // When computed monthly changes (due to term/interest changes), clear override
  useEffect(() => {
    if (isOverridden && computedMonthly !== null) {
      // Only clear if the override matches the old computed value (user hasn't customised)
      // We leave any custom override intact unless they reset manually
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedMonthly]);

  const { format: formatCurrency } = useCurrency();

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Installment Details</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Down Payment <HelpTip text="Amount paid upfront by the customer. Subtracted from the total before calculating monthly payments." /></Label>
          <div className="flex gap-1 mb-1.5 flex-wrap">
            {PRESET_DOWN_PCT.map((pct) => {
              const val = Math.round((saleTotal * pct) / 100);
              return (
                <Button
                  key={pct}
                  type="button"
                  size="sm"
                  variant={config.down_payment === val ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => onChange({ ...config, down_payment: val })}
                >
                  {pct}%
                </Button>
              );
            })}
          </div>
          <Input
            type="number"
            min={0}
            max={saleTotal}
            step={100}
            value={config.down_payment}
            onChange={(e) =>
              onChange({ ...config, down_payment: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Penalty Rate (%)
            <span className="ml-1 text-xs text-muted-foreground font-normal">— optional</span>
            <HelpTip text="Percentage charged on the outstanding balance when a payment is missed. Set to 0 to disable penalties." />
          </Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={config.penalty_rate}
            placeholder="0"
            onChange={(e) =>
              onChange({ ...config, penalty_rate: parseFloat(e.target.value) || 0 })
            }
          />
          {config.penalty_rate === 0 && (
            <p className="text-xs text-muted-foreground">No penalty will be charged.</p>
          )}
        </div>
      </div>

      {/* Term + Start Date — always visible for installments */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Term (months) <HelpTip text="Number of monthly installments. Common terms: 6, 12, 18, or 24 months." /></Label>
          <div className="flex gap-1 mb-1.5 flex-wrap">
            {PRESET_TERMS.map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={config.term_months === t ? "default" : "outline"}
                className="h-7 px-2 text-xs"
                onClick={() => onChange({ ...config, term_months: t, monthly_payment_override: null })}
              >
                {t}mo
              </Button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            max={60}
            value={config.term_months ?? ""}
            onChange={(e) =>
              onChange({ ...config, term_months: parseInt(e.target.value) || null, monthly_payment_override: null })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Start Date</Label>
          <Input
            type="date"
            value={config.start_date ?? ""}
            onChange={(e) => onChange({ ...config, start_date: e.target.value || null })}
          />
        </div>
      </div>

      {/* Advanced: Interest — off by default */}
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        onClick={toggleAdvanced}
      >
        {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Advanced — Interest Settings
        {!showAdvanced && config.interest_rate === 0 && (
          <span className="ml-1 text-xs">(off)</span>
        )}
      </button>

      {showAdvanced && (
        <div className="space-y-4 pl-1 border-l-2 border-muted ml-1">
          <p className="text-xs text-muted-foreground">
            Only needed if you charge additional interest on top of the installment price.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Interest Rate ({rateLabel}) <HelpTip text="Add-on (flat) interest rate. The formula depends on the selected interest type." /></Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={config.interest_rate}
                onChange={(e) =>
                  onChange({ ...config, interest_rate: parseFloat(e.target.value) || 0, monthly_payment_override: null })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Interest Type <HelpTip text="Monthly: rate applied per month. Annual: rate applied per year. Flat Total: rate applied once on principal." /></Label>
            <div className="flex gap-1">
              {INTEREST_TYPE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="sm"
                  variant={interestType === opt.value ? "default" : "outline"}
                  className="h-7 px-3 text-xs"
                  onClick={() => onChange({ ...config, interest_type: opt.value, monthly_payment_override: null })}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {rebateEnabled && (
        <div className="space-y-1.5">
          <Label>Rebate Amount (₱) <HelpTip text="Fixed peso amount credited back when the customer pays off the account on time." /></Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={config.rebate_amount ?? 0}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              onChange({ ...config, rebate_amount: Math.max(0, val) });
            }}
          />
          <p className="text-xs text-muted-foreground">
            Fixed peso amount refunded if paid on time
          </p>
        </div>
      )}

      <Separator />

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sale Total</span>
          <span>{formatCurrency(saleTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Down Payment</span>
          <span>- {formatCurrency(config.down_payment)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Principal</span>
          <span>{formatCurrency(principal > 0 ? principal : 0)}</span>
        </div>
        {interest && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Interest ({config.interest_rate}%
                {interestType === "monthly"
                  ? ` × ${config.term_months ?? 0}mo`
                  : interestType === "annual"
                    ? ` × ${((config.term_months ?? 0) / 12).toFixed(1)}yr`
                    : " flat"}
                )
              </span>
              <span>{formatCurrency(interest.totalInterest)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Total Payable</span>
              <span>{formatCurrency(interest.totalPayable)}</span>
            </div>
          </>
        )}
        {computedMonthly !== null && (
          <div className="flex items-center justify-between pt-1">
            <span className="font-semibold text-primary flex items-center gap-1">
              Monthly Payment
              <HelpTip text="Edit to override the calculated amount (e.g. to round to a whole number). The last payment will absorb any rounding difference." />
            </span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                step={1}
                className="w-32 h-7 text-right text-sm font-semibold tabular-nums"
                value={displayedMonthly}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  onChange({ ...config, monthly_payment_override: val > 0 ? val : null });
                }}
              />
              {isOverridden && (
                <button
                  type="button"
                  title="Reset to calculated amount"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onChange({ ...config, monthly_payment_override: null })}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
        {isOverridden && computedMonthly !== null && (
          <p className="text-xs text-muted-foreground text-right">
            Calculated: {formatCurrency(computedMonthly)} — last payment absorbs difference
          </p>
        )}
      </div>

      {config.term_months && config.start_date && (
        <button
          type="button"
          className="text-sm text-primary underline hover:no-underline"
          onClick={onPreviewSchedule}
        >
          Preview Payment Schedule →
        </button>
      )}
    </div>
  );
}

