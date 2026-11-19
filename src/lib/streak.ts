import { getBangkokToday, isValidIsoCalendarDate } from "./date";
import type { StreakSummary } from "./types";

function addDaysToIso(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d) + deltaDays * 86_400_000;
  const next = new Date(utc);
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(next.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/**
 * Computes daily recording streak stats from transaction dates using Asia/Bangkok "today".
 * Future-dated transactions (later than todayIso) are excluded so planned entries don't inflate streaks.
 */
export function computeRecordingStreak(
  transactionDates: string[],
  todayIso: string = getBangkokToday()
): StreakSummary {
  const uniqueDates = new Set<string>();
  for (const dateStr of transactionDates) {
    if (isValidIsoCalendarDate(dateStr) && dateStr <= todayIso) {
      uniqueDates.add(dateStr);
    }
  }

  if (uniqueDates.size === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalRecordedDays: 0,
      recordedToday: false,
      atRisk: false,
      lastRecordedDate: null,
    };
  }

  const sortedDates = Array.from(uniqueDates).sort();
  const lastRecordedDate = sortedDates[sortedDates.length - 1] ?? null;
  const recordedToday = uniqueDates.has(todayIso);
  const yesterdayIso = addDaysToIso(todayIso, -1);

  let currentStreak = 0;
  let cursor: string | null = recordedToday
    ? todayIso
    : uniqueDates.has(yesterdayIso)
      ? yesterdayIso
      : null;

  while (cursor && uniqueDates.has(cursor)) {
    currentStreak += 1;
    cursor = addDaysToIso(cursor, -1);
  }

  let longestStreak = 0;
  let currentRun = 0;
  let prevDate: string | null = null;

  for (const dateStr of sortedDates) {
    if (prevDate && addDaysToIso(prevDate, 1) === dateStr) {
      currentRun += 1;
    } else {
      currentRun = 1;
    }
    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
    prevDate = dateStr;
  }

  return {
    currentStreak,
    longestStreak,
    totalRecordedDays: uniqueDates.size,
    recordedToday,
    atRisk: !recordedToday && currentStreak > 0,
    lastRecordedDate,
  };
}
