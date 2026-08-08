function padTwo(value: number): string {
  return String(value).padStart(2, '0');
}

export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

export function getLocalMonthString(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}`;
}

export function getTodayLocalDateString(): string {
  return toLocalDateString(new Date());
}

export function getRelativeLocalDateString(dayOffset: number, baseDate: Date = new Date()): string {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + dayOffset);
  return toLocalDateString(date);
}

export function parseLocalDateString(dateString: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    return new Date(dateString);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
}

export function getMonthRangeForDate(date: Date): { startDate: string; endDate: string } {
  return getMonthRangeForYearMonth(date.getFullYear(), date.getMonth() + 1);
}

export function getMonthRangeForYearMonth(
  year: number,
  monthOneBased: number
): { startDate: string; endDate: string } {
  const startDate = toLocalDateString(new Date(year, monthOneBased - 1, 1));
  const endDate = toLocalDateString(new Date(year, monthOneBased, 0));
  return { startDate, endDate };
}

/**
 * Parse a `?month=YYYY-MM` query parameter, falling back to the current local
 * month when it is absent. Returns null for anything malformed (bug-hunt
 * finding SEC5): routes used to `parseInt` the halves unchecked, so `?month=foo`
 * produced NaN year/month, getMonthRangeForYearMonth built a "NaN-NaN-NaN"
 * range, and every date comparison silently matched nothing — a confident 200
 * reporting $0 spent for the month.
 */
export function parseYearMonthParam(
  monthParam: string | null,
  now: Date = new Date()
): { year: number; month: number } | null {
  if (!monthParam) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  if (!/^\d{4}-\d{2}$/.test(monthParam)) return null;
  const [yearStr, monthStr] = monthParam.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function getYearRangeForDate(date: Date): { startDate: string; endDate: string } {
  const year = date.getFullYear();
  const startDate = toLocalDateString(new Date(year, 0, 1));
  const endDate = toLocalDateString(new Date(year, 11, 31));
  return { startDate, endDate };
}
