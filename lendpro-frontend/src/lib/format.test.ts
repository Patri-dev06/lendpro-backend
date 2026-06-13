import { describe, it, expect } from "vitest";
import { formatPHP, formatDate, addDays, addNonSundayDays } from "./format";

describe("formatPHP", () => {
  it("formats whole numbers with two decimal places", () => {
    expect(formatPHP(1000)).toBe("₱1,000.00");
  });

  it("formats decimal amounts correctly", () => {
    expect(formatPHP(1234.5)).toBe("₱1,234.50");
  });

  it("formats zero", () => {
    expect(formatPHP(0)).toBe("₱0.00");
  });

  it("formats negative amounts", () => {
    expect(formatPHP(-500)).toBe("₱-500.00");
  });

  it("compact: formats thousands with K suffix", () => {
    expect(formatPHP(1500, { compact: true })).toBe("₱1.5K");
  });

  it("compact: formats millions with M suffix", () => {
    expect(formatPHP(2500000, { compact: true })).toBe("₱2.5M");
  });

  it("compact: does not abbreviate amounts under 1000", () => {
    expect(formatPHP(999, { compact: true })).toBe("₱999.00");
  });
});

describe("formatDate", () => {
  it("formats a date string to readable format", () => {
    const result = formatDate("2026-01-15");
    expect(result).toBe("Jan 15, 2026");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date(2026, 0, 15));
    expect(result).toBe("Jan 15, 2026");
  });
});

describe("addDays", () => {
  it("adds days to a date string", () => {
    const result = addDays("2026-01-01", 7);
    expect(result.getDate()).toBe(8);
    expect(result.getMonth()).toBe(0);
    expect(result.getFullYear()).toBe(2026);
  });

  it("rolls over to next month correctly", () => {
    const result = addDays("2026-01-28", 5);
    expect(result.getDate()).toBe(2);
    expect(result.getMonth()).toBe(1);
  });
});

describe("addNonSundayDays", () => {
  it("skips Sundays when counting days", () => {
    // 2026-01-05 is a Monday — adding 5 non-Sunday days should skip the Sunday (Jan 11)
    const result = addNonSundayDays("2026-01-05", 5);
    // Mon Jan 5 + 5 non-Sunday days: Tue(6), Wed(7), Thu(8), Fri(9), Sat(10) = Jan 10
    expect(result.toISOString().slice(0, 10)).toBe("2026-01-10");
  });

  it("skips configured holidays", () => {
    // Starting from Jan 5 (Mon), adding 1 non-Sunday day but Jan 6 is a holiday
    const result = addNonSundayDays("2026-01-05", 1, ["2026-01-06"]);
    // Jan 6 skipped (holiday), next is Jan 7
    expect(result.toISOString().slice(0, 10)).toBe("2026-01-07");
  });

  it("skips both Sundays and holidays", () => {
    // Jan 10 (Sat) → next day Jan 11 is Sunday, Jan 12 is a holiday → lands on Jan 13
    const result = addNonSundayDays("2026-01-10", 1, ["2026-01-12"]);
    expect(result.toISOString().slice(0, 10)).toBe("2026-01-13");
  });

  it("works with no holidays", () => {
    const result = addNonSundayDays("2026-01-01", 0);
    expect(result.toISOString().slice(0, 10)).toBe("2026-01-01");
  });
});
