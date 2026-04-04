import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/formatters";
import { calculateAddOnInterest } from "@/lib/interest";
import type { CreateInstallmentPayload } from "@/types/sale";

interface InstallmentConfigPanelProps {
  saleTotal: number;
  config: CreateInstallmentPayload;
  onChange: (config: CreateInstallmentPayload) => void;
  onPreviewSchedule: () => void;
}

export function InstallmentConfigPanel({
  saleTotal,
  config,
  onChange,
  onPreviewSchedule,
}: InstallmentConfigPanelProps) {
  const principal = saleTotal - config.down_payment;

  const interest =
    config.has_schedule && config.term_months
      ? calculateAddOnInterest(principal, config.interest_rate, config.term_months)
      : null;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">Installment Details</h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Down Payment</Label>
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
          <Label>Interest Rate (% p.a.)</Label>
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
        <div className="space-y-1.5">
          <Label>Penalty Rate (%)</Label>
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
        <div className="flex items-end pb-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={config.has_schedule}
              onCheckedChange={(checked) =>
                onChange({
                  ...config,
                  has_schedule: !!checked,
                  term_months: checked ? config.term_months ?? 6 : null,
                  start_date: checked ? config.start_date ?? new Date().toISOString().split("T")[0] : null,
                })
              }
            />
            <Label>Fixed Schedule</Label>
          </div>
        </div>
      </div>

      {config.has_schedule && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Term (months)</Label>
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
                Interest ({config.interest_rate}% × {((config.term_months ?? 0) / 12).toFixed(1)} yr)
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
        {!config.has_schedule && (
          <p className="text-xs text-muted-foreground italic">
            No fixed schedule — customer pays flexibly against the balance.
          </p>
        )}
      </div>

      {config.has_schedule && config.term_months && config.start_date && (
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
