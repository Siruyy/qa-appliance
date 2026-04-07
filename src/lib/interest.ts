import { addMonths, format } from "date-fns";
import type { InterestType } from "@/types/account";

export interface SchedulePreviewEntry {
  due_date: string;
  amount_due: number;
  month_number: number;
  principal_portion: number;
  interest_portion: number;
}

/**
 * Calculate add-on (flat) interest with three modes:
 *   monthly:    totalInterest = principal × (rate/100) × termMonths
 *   annual:     totalInterest = principal × (rate/100) × (termMonths/12)
 *   flat_total: totalInterest = principal × (rate/100)
 *
 * Returns per-month breakdown values as well.
 */
export function calculateAddOnInterest(
  principal: number,
  rate: number,
  termMonths: number,
  interestType: InterestType = "monthly"
): {
  totalInterest: number;
  totalPayable: number;
  monthlyPayment: number;
  interestPerMonth: number;
  principalPerMonth: number;
} {
  let totalInterest: number;
  switch (interestType) {
    case "annual":
      totalInterest = principal * (rate / 100) * (termMonths / 12);
      break;
    case "flat_total":
      totalInterest = principal * (rate / 100);
      break;
    default: // "monthly"
      totalInterest = principal * (rate / 100) * termMonths;
      break;
  }
  const totalPayable = principal + totalInterest;
  const monthlyPayment = Math.ceil((totalPayable / termMonths) * 100) / 100;
  const interestPerMonth = Math.round((totalInterest / termMonths) * 100) / 100;
  const principalPerMonth = Math.round((principal / termMonths) * 100) / 100;
  return { totalInterest, totalPayable, monthlyPayment, interestPerMonth, principalPerMonth };
}

/**
 * Generate monthly payment schedule starting from a given date.
 * Each payment is due on the same day of each subsequent month.
 * Uses date-fns addMonths to handle month-boundary edge cases safely
 * (e.g., Jan 31 + 1 month = Feb 28, not Mar 3).
 *
 * The last payment is adjusted so the schedule sums exactly to totalPayable.
 */
export function generatePaymentSchedule(
  monthlyPayment: number,
  termMonths: number,
  startDate: string,
  totalPayable?: number,
  principalPerMonth?: number,
  interestPerMonth?: number
): SchedulePreviewEntry[] {
  const schedule: SchedulePreviewEntry[] = [];
  const start = new Date(startDate);
  const pPortion = principalPerMonth ?? 0;
  const iPortion = interestPerMonth ?? 0;

  for (let i = 0; i < termMonths; i++) {
    const due = addMonths(start, i + 1);

    schedule.push({
      due_date: format(due, "yyyy-MM-dd"),
      amount_due: monthlyPayment,
      month_number: i + 1,
      principal_portion: pPortion,
      interest_portion: iPortion,
    });
  }

  // Adjust last payment to absorb rounding so total matches exactly
  if (schedule.length > 0 && totalPayable !== undefined) {
    const sumOfOthers = monthlyPayment * (termMonths - 1);
    schedule[schedule.length - 1].amount_due =
      Math.round((totalPayable - sumOfOthers) * 100) / 100;
  }

  return schedule;
}
