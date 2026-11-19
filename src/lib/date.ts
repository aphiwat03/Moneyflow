export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

function getBangkokDateParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  if (!year || !month || !day) {
    throw new Error("Failed to extract Asia/Bangkok date parts");
  }

  return { year, month, day };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Returns today's date in Asia/Bangkok timezone as YYYY-MM-DD.
 * Prevents UTC midnight drift on Vercel servers between 00:00 and 06:59 ICT.
 */
export function getBangkokToday(now: Date = new Date()): string {
  const { year, month, day } = getBangkokDateParts(now);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function getBangkokYearMonth(now: Date = new Date()): {
  year: number;
  month: number;
} {
  const { year, month } = getBangkokDateParts(now);
  return { year, month };
}

export interface PaydayCycleRange {
  startDate: string;
  endDate: string;
  totalDays: number;
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatUtcDateIso(utcMs: number): string {
  const d = new Date(utcMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function getMonthDateRange(
  year: number,
  month: number
): { startDate: string; endDate: string } {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid year/month: ${year}-${month}`);
  }

  const lastDay = daysInUtcMonth(year, month);
  return {
    startDate: `${year}-${pad2(month)}-01`,
    endDate: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
}

/**
 * Computes the salary cycle [startDate, endDate] for a given (year, month) and payday (1..31).
 * For payday >= 20, the cycle for `month` starts on `payday` of the previous month and ends the day before `payday` in `month`.
 */
export function getPaydayCycleDateRange(
  year: number,
  month: number,
  payday: number = 1
): PaydayCycleRange {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid year/month: ${year}-${month}`);
  }

  const clampedPayday = Math.min(31, Math.max(1, Math.trunc(payday || 1)));

  let startYear = year;
  let startMonth = month;
  if (clampedPayday >= 20) {
    startMonth = month === 1 ? 12 : month - 1;
    startYear = month === 1 ? year - 1 : year;
  }

  const endMonth = startMonth === 12 ? 1 : startMonth + 1;
  const endYear = startMonth === 12 ? startYear + 1 : startYear;

  const startDay = Math.min(clampedPayday, daysInUtcMonth(startYear, startMonth));
  const nextPaydayDay = Math.min(clampedPayday, daysInUtcMonth(endYear, endMonth));

  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const nextPaydayUtc = Date.UTC(endYear, endMonth - 1, nextPaydayDay);
  const endUtc = nextPaydayUtc - 86_400_000;

  return {
    startDate: formatUtcDateIso(startUtc),
    endDate: formatUtcDateIso(endUtc),
    totalDays: Math.round((nextPaydayUtc - startUtc) / 86_400_000),
  };
}

export function getBangkokCurrentMonthRange(now: Date = new Date()): {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
} {
  const { year, month } = getBangkokYearMonth(now);
  return { year, month, ...getMonthDateRange(year, month) };
}

export function getBangkokPreviousMonthRange(now: Date = new Date()): {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
} {
  const current = getBangkokYearMonth(now);
  const year = current.month === 1 ? current.year - 1 : current.year;
  const month = current.month === 1 ? 12 : current.month - 1;
  return { year, month, ...getMonthDateRange(year, month) };
}

export function isValidIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

/**
 * Formats a YYYY-MM-DD DATE value for display without local timezone shifting.
 */
export function formatIsoDateForDisplay(
  isoDate: string,
  locale: string = "th-TH"
): string {
  if (!isValidIsoCalendarDate(isoDate)) {
    return isoDate;
  }

  const [year, month, day] = isoDate.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(utcDate);
}
