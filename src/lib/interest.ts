export interface PaymentScheduleEntry {
  due_date: string;
  amount_due: number;
  month_number: number;
}

/**
 * Add-on interest: total_interest = principal * rate% * term_years
 * Total payable = principal + total_interest
 * Monthly = total_payable / term_months
 */
export function calculateAddOnInterest(
  principal: number,
  annualRate: number,
  termMonths: number
): { totalInterest: number; totalPayable: number; monthlyPayment: number } {
  const termYears = termMonths / 12;
  const totalInterest = principal * (annualRate / 100) * termYears;
  const totalPayable = principal + totalInterest;
  const monthlyPayment = Math.ceil(totalPayable / termMonths);
  return { totalInterest, totalPayable, monthlyPayment };
}

/**
 * Generate monthly payment schedule starting from a given date.
 * Each payment is due on the same day of each subsequent month.
 */
export function generatePaymentSchedule(
  monthlyPayment: number,
  termMonths: number,
  startDate: string
): PaymentScheduleEntry[] {
  const schedule: PaymentScheduleEntry[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < termMonths; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i + 1);

    schedule.push({
      due_date: due.toISOString().split("T")[0],
      amount_due: monthlyPayment,
      month_number: i + 1,
    });
  }

  // Adjust last payment to absorb rounding
  if (schedule.length > 0) {
    const sumSoFar = monthlyPayment * (termMonths - 1);
    const totalPayable = monthlyPayment * termMonths; // already ceiled
    schedule[schedule.length - 1].amount_due = totalPayable - sumSoFar;
  }

  return schedule;
}
