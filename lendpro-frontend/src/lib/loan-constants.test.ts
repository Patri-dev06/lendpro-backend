import { describe, it, expect } from "vitest";
import { LOAN_TYPE_LABELS, TERM_OPTIONS } from "./loan-constants";
import { calcTotalReceivable, calcDailyPayment, calcEfficiencyRate } from "./loan-calc";

describe("LOAN_TYPE_LABELS", () => {
  it("maps new-loan to 'New Loan'", () => {
    expect(LOAN_TYPE_LABELS["new-loan"]).toBe("New Loan");
  });

  it("maps reloan to 'Reloan'", () => {
    expect(LOAN_TYPE_LABELS["reloan"]).toBe("Reloan");
  });

  it("maps reconstruct to 'Reconstruct'", () => {
    expect(LOAN_TYPE_LABELS["reconstruct"]).toBe("Reconstruct");
  });

  it("covers all three loan types", () => {
    expect(Object.keys(LOAN_TYPE_LABELS)).toHaveLength(3);
  });
});

describe("TERM_OPTIONS", () => {
  it("contains 30, 45, and 60 day terms", () => {
    expect(TERM_OPTIONS).toContain(30);
    expect(TERM_OPTIONS).toContain(45);
    expect(TERM_OPTIONS).toContain(60);
  });

  it("has exactly 3 term options", () => {
    expect(TERM_OPTIONS).toHaveLength(3);
  });

  it("terms are in ascending order", () => {
    const sorted = [...TERM_OPTIONS].sort((a, b) => a - b);
    expect([...TERM_OPTIONS]).toEqual(sorted);
  });
});

describe("loan calculation helpers (via loan-calc)", () => {
  it("calculates total receivable correctly", () => {
    // ₱10,000 principal, ₱500 interest (5%), ₱200 processing fee (2%)
    expect(calcTotalReceivable(10000, 500, 200)).toBe(10700);
  });

  it("daily payment rounds UP — ₱10,700 / 30 days = 357", () => {
    expect(calcDailyPayment(10700, 30)).toBe(357);
  });

  it("daily payment rounds UP — ₱10,750 / 45 days = 239", () => {
    expect(calcDailyPayment(10750, 45)).toBe(239);
  });

  it("daily payment divides evenly — ₱10,800 / 60 days = 180", () => {
    expect(calcDailyPayment(10800, 60)).toBe(180);
  });

  it("efficiency rate returns 0 when expected is 0", () => {
    expect(calcEfficiencyRate(500, 0)).toBe(0);
  });

  it("efficiency rate caps at 100%", () => {
    expect(calcEfficiencyRate(9999, 100)).toBe(100);
  });

  it("efficiency rate calculates correctly", () => {
    expect(calcEfficiencyRate(750, 1000)).toBe(75);
  });

  it("efficiency rate rounds to whole number", () => {
    expect(calcEfficiencyRate(1, 3)).toBe(33);
  });
});
