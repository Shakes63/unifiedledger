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

export function getYearRangeForDate(date: Date): { startDate: string; endDate: string } {
  const year = date.getFullYear();
  const startDate = toLocalDateString(new Date(year, 0, 1));
  const endDate = toLocalDateString(new Date(year, 11, 31));
  return { startDate, endDate };
}
