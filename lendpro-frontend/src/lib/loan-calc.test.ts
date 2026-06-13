import { describe, it, expect } from "vitest";
import {
  getTermInterestRate,
  calcInterest,
  calcServiceCharge,
  calcTotalReceivable,
  calcDailyPayment,
  calcNewBalance,
  calcEfficiencyRate,
} from "./loan-calc";

describe("getTermInterestRate", () => {
  it("returns 5% for 30-day term", () => {
    expect(getTermInterestRate(30)).toBe(5);
  });
  it("returns 7.5% for 45-day term", () => {
    expect(getTermInterestRate(45)).toBe(7.5);
  });
  it("returns 10% for 60-day term", () => {
    expect(getTermInterestRate(60)).toBe(10);
  });
  it("scales proportionally for custom 90-day term", () => {
    // 90/30 * 5 = 15%
    expect(getTermInterestRate(90)).toBe(15);
  });
});

describe("calcInterest", () => {
  it("₱10,000 × 5% for 30 days = ₱500", () => {
    expect(calcInterest(10000, 30)).toBe(500);
  });
  it("₱10,000 × 7.5% for 45 days = ₱750", () => {
    expect(calcInterest(10000, 45)).toBe(750);
  });
  it("₱10,000 × 10% for 60 days = ₱1,000", () => {
    expect(calcInterest(10000, 60)).toBe(1000);
  });
  it("₱5,000 × 7.5% for 45 days = ₱375", () => {
    expect(calcInterest(5000, 45)).toBe(375);
  });
  it("₱15,000 × 7.5% for 45 days = ₱1,125", () => {
    expect(calcInterest(15000, 45)).toBe(1125);
  });
});

describe("calcServiceCharge", () => {
  it("₱10,000 at 2% = ₱200", () => {
    expect(calcServiceCharge(10000, 2)).toBe(200);
  });
  it("returns 0 when rate is 0", () => {
    expect(calcServiceCharge(10000, 0)).toBe(0);
  });
  it("₱7,500 at 2% = ₱150", () => {
    expect(calcServiceCharge(7500, 2)).toBe(150);
  });
  it("₱15,000 at 2% = ₱300", () => {
    expect(calcServiceCharge(15000, 2)).toBe(300);
  });
});

describe("calcTotalReceivable", () => {
  it("₱10,000 + ₱750 interest + ₱200 sc = ₱10,950", () => {
    expect(calcTotalReceivable(10000, 750, 200)).toBe(10950);
  });
  it("equals principal + interest when sc is 0", () => {
    expect(calcTotalReceivable(10000, 500, 0)).toBe(10500);
  });
  it("₱10,000 + ₱500 + ₱200 = ₱10,700", () => {
    expect(calcTotalReceivable(10000, 500, 200)).toBe(10700);
  });
});

describe("calcDailyPayment — rounds UP (Math.ceil)", () => {
  it("₱10,700 / 30 days = 357, not 356.67", () => {
    // Math.ceil(356.666...) = 357
    expect(calcDailyPayment(10700, 30)).toBe(357);
  });
  it("₱10,750 / 45 days = 239, not 238.89", () => {
    // Math.ceil(238.888...) = 239
    expect(calcDailyPayment(10750, 45)).toBe(239);
  });
  it("₱10,800 / 60 days = 180 (divides evenly)", () => {
    expect(calcDailyPayment(10800, 60)).toBe(180);
  });
  it("returns 0 when term is 0", () => {
    expect(calcDailyPayment(10000, 0)).toBe(0);
  });
  it("returns 0 when total receivable is 0", () => {
    expect(calcDailyPayment(0, 30)).toBe(0);
  });
});

describe("calcNewBalance — clamps at 0", () => {
  it("subtracts payment from balance", () => {
    expect(calcNewBalance(10000, 357)).toBe(9643);
  });
  it("exact final payment clears balance to 0", () => {
    expect(calcNewBalance(357, 357)).toBe(0);
  });
  it("overpayment clamps at 0 — never negative", () => {
    expect(calcNewBalance(357, 400)).toBe(0);
  });
  it("payment on a zero balance stays at 0", () => {
    expect(calcNewBalance(0, 357)).toBe(0);
  });
});

describe("calcEfficiencyRate", () => {
  it("75% when collected ₱750 of ₱1,000 expected", () => {
    expect(calcEfficiencyRate(750, 1000)).toBe(75);
  });
  it("caps at 100% even when overcollected", () => {
    expect(calcEfficiencyRate(9999, 100)).toBe(100);
  });
  it("returns 0 when expected is 0", () => {
    expect(calcEfficiencyRate(500, 0)).toBe(0);
  });
  it("rounds to whole number — 1/3 = 33%", () => {
    expect(calcEfficiencyRate(1, 3)).toBe(33);
  });
  it("100% when fully collected", () => {
    expect(calcEfficiencyRate(1000, 1000)).toBe(100);
  });
});

describe("full loan lifecycle", () => {
  it("30-day loan: balance reaches exactly ₱0 after all payments", () => {
    // ₱10,000 principal | 5% interest = ₱500 | 2% sc = ₱200 | total = ₱10,700
    // daily = Math.ceil(10700/30) = 357
    // after 30 payments: last payment covers the remainder without going negative
    const principal = 10000;
    const interest  = calcInterest(principal, 30);         // 500
    const sc        = calcServiceCharge(principal, 2);     // 200
    const total     = calcTotalReceivable(principal, interest, sc); // 10700
    const daily     = calcDailyPayment(total, 30);         // 357

    let balance = total;
    for (let i = 0; i < 30; i++) {
      balance = calcNewBalance(balance, daily);
    }
    expect(balance).toBe(0);
  });

  it("45-day loan: balance reaches exactly ₱0 after all payments", () => {
    // ₱15,000 principal | 7.5% = ₱1,125 | 2% sc = ₱300 | total = ₱16,425
    // daily = Math.ceil(16425/45) = 365 (exact — no remainder)
    const principal = 15000;
    const interest  = calcInterest(principal, 45);         // 1125
    const sc        = calcServiceCharge(principal, 2);     // 300
    const total     = calcTotalReceivable(principal, interest, sc); // 16425
    const daily     = calcDailyPayment(total, 45);         // 365

    let balance = total;
    for (let i = 0; i < 45; i++) {
      balance = calcNewBalance(balance, daily);
    }
    expect(balance).toBe(0);
  });

  it("60-day loan: balance reaches exactly ₱0 after all payments", () => {
    // ₱10,000 principal | 10% = ₱1,000 | 2% sc = ₱200 | total = ₱11,200
    // daily = Math.ceil(11200/60) = Math.ceil(186.666) = 187
    const principal = 10000;
    const interest  = calcInterest(principal, 60);         // 1000
    const sc        = calcServiceCharge(principal, 2);     // 200
    const total     = calcTotalReceivable(principal, interest, sc); // 11200
    const daily     = calcDailyPayment(total, 60);         // 187

    let balance = total;
    for (let i = 0; i < 60; i++) {
      balance = calcNewBalance(balance, daily);
    }
    expect(balance).toBe(0);
  });

  it("paying more than daily reduces balance faster without going negative", () => {
    const total = calcTotalReceivable(10000, 500, 200); // 10700
    const daily = calcDailyPayment(total, 30);          // 357

    let balance = total;
    balance = calcNewBalance(balance, daily * 2); // double payment
    expect(balance).toBe(total - daily * 2);
    expect(balance).toBeGreaterThan(0);
  });

  it("single large payment clears entire balance without going negative", () => {
    const total = calcTotalReceivable(10000, 750, 200); // 10950
    const balance = calcNewBalance(total, total + 999); // overpay by ₱999
    expect(balance).toBe(0);
  });
});
