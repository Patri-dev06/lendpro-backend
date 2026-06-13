export function formatPHP(n: number, opts: { compact?: boolean } = {}) {
  if (opts.compact && Math.abs(n) >= 1000) {
    return "₱" + new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  }
  return "₱" + new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-PH", opts ?? { year: "numeric", month: "short", day: "numeric" }).format(date);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-PH").format(n);
}

export function addDays(d: Date | string, days: number) {
  const date = typeof d === "string" ? new Date(d) : new Date(d);
  date.setDate(date.getDate() + days);
  return date;
}

export function addCalendarDays(startDate: Date | string, n: number, holidays: string[] = []): Date {
  const skip = new Set(holidays);
  const d = typeof startDate === "string" ? new Date(startDate) : new Date(startDate);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const isSunday  = d.getDay() === 0;
    const isHoliday = skip.has(d.toISOString().slice(0, 10));
    if (!isSunday && !isHoliday) added++;
  }
  return d;
}
