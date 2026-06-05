export function getTermInterestRate(termDays: number): number {
  // 1 month (30 days) = 5%, 1.5 months (45 days) = 7.5%, 2 months (60 days) = 10%
  return (termDays / 30) * 5;
}

export function getTermMultiplier(termDays: number): number {
  return termDays / 30;
}

export function calcInterest(principal: number, termDays: number): number {
  return Math.round(principal * getTermInterestRate(termDays) / 100);
}

export function calcServiceCharge(principal: number, scRatePercent: number): number {
  return Math.round(principal * scRatePercent / 100);
}

export function calcTotalReceivable(principal: number, interest: number, serviceCharge: number): number {
  return principal + interest + serviceCharge;
}

/** Daily payment rounds UP so the loan fully clears within the term.
 *  Divides by collection days (calendar days minus Sundays). */
export function calcDailyPayment(totalReceivable: number, termDays: number): number {
  if (termDays <= 0 || totalReceivable <= 0) return 0;
  const collectionDays = termDays - Math.floor(termDays / 7);
  return Math.ceil(totalReceivable / collectionDays);
}

/** Balance is clamped at 0 — overpayments never produce a negative balance. */
export function calcNewBalance(currentBalance: number, payment: number): number {
  return Math.max(0, currentBalance - payment);
}

export function calcEfficiencyRate(collected: number, expected: number): number {
  if (expected <= 0) return 0;
  return Math.min(100, Math.round((collected / expected) * 100));
}
