export type LoanType = "new-loan" | "reloan" | "reconstruct";

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  "new-loan":    "New Loan",
  "reloan":      "Reloan",
  "reconstruct": "Reconstruct",
};

export const TERM_OPTIONS = [30, 45, 60] as const;
