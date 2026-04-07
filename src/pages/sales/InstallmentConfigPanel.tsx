import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { HelpTip } from "@/components/help/HelpTip";
import { useCurrency } from "@/hooks/useCurrency";
import { calculateAddOnInterest } from "@/lib/interest";
import type { CreateInstallmentPayload } from "@/types/sale";
import type { InterestType } from "@/types/account";

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
    config.term_months
      ? calculateAddOnInterest(principal, config.interest_rate, config.term_months, interestType)
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
          <Label>Interest Rate ({rateLabel}) <HelpTip text="Add-on (flat) interest rate. The formula depends on the selected interest type." /></Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={config.interest_rate}
            onChange={(e) =>
              onChange({ ...config, interest_rate: parseFloat(e.target.value) || 0 })
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
              onClick={() => onChange({ ...config, interest_type: opt.value })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Penalty Rate (%) <HelpTip text="Percentage charged when a payment is missed past the due date." /></Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={config.penalty_rate}
            onChange={(e) =>
              onChange({ ...config, penalty_rate: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        {rebateEnabled && (
          <div className="space-y-1.5">
            <Label>Rebate Rate (%) <HelpTip text="Discount percentage applied when the customer pays off the account early." /></Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={config.rebate_rate ?? 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                onChange({ ...config, rebate_rate: Math.min(100, Math.max(0, val)) });
              }}
            />
            <p className="text-xs text-muted-foreground">
              % of interest refunded if paid on time
            </p>
          </div>
        )}
      </div>

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
                onClick={() => onChange({ ...config, term_months: t })}
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
              onChange({ ...config, term_months: parseInt(e.target.value) || null })
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
            <div className="flex justify-between text-primary font-semibold">
              <span>Monthly Payment</span>
              <span>{formatCurrency(interest.monthlyPayment)}</span>
            </div>
          </>
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
