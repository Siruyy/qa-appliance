import { addMonths, format } from "date-fns";

export interface PaymentScheduleEntry {
  due_date: string;
  amount_due: number;
  month_number: number;
}

/**
 * Add-on interest: total_interest = principal * rate% * term_years
 * Total payable = principal + total_interest
 * Monthly = ceil(total_payable / term_months) — last payment absorbs rounding.
 */
export function calculateAddOnInterest(
  principal: number,
  annualRate: number,
  termMonths: number
): { totalInterest: number; totalPayable: number; monthlyPayment: number } {
  const termYears = termMonths / 12;
  const totalInterest = principal * (annualRate / 100) * termYears;
  const totalPayable = principal + totalInterest;
  const monthlyPayment = Math.ceil((totalPayable / termMonths) * 100) / 100;
  return { totalInterest, totalPayable, monthlyPayment };
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
  totalPayable?: number
): PaymentScheduleEntry[] {
  const schedule: PaymentScheduleEntry[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < termMonths; i++) {
    const due = addMonths(start, i + 1);

    schedule.push({
      due_date: format(due, "yyyy-MM-dd"),
      amount_due: monthlyPayment,
      month_number: i + 1,
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
