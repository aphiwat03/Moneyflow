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

export interface StreakEvolutionTier {
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  minDays: number;
  title: string;
  subtitle: string;
  badgeText: string;
  accentTextClass: string;
  pillBorderClass: string;
}

export const STREAK_EVOLUTION_TIERS: readonly StreakEvolutionTier[] = [
  {
    level: 0,
    minDays: 0,
    title: "ถ่านรอจุด",
    subtitle: "เริ่มจดรายการแรกเพื่อจุดไฟ",
    badgeText: "Lv.0",
    accentTextClass: "text-slate-500 dark:text-slate-400",
    pillBorderClass: "border-border",
  },
  {
    level: 1,
    minDays: 1,
    title: "ประกายไฟเริ่มต้น",
    subtitle: "เริ่มต้นได้ดี จดต่อเนื่องทุกวัน!",
    badgeText: "Lv.1",
    accentTextClass: "text-orange-600 dark:text-orange-400",
    pillBorderClass: "border-orange-300 dark:border-orange-700",
  },
  {
    level: 2,
    minDays: 3,
    title: "เปลวไฟมีวินัย",
    subtitle: "ติดไฟต่อเนื่องครบ 3 วันแล้ว",
    badgeText: "Lv.2",
    accentTextClass: "text-amber-600 dark:text-amber-400",
    pillBorderClass: "border-amber-400 dark:border-amber-600",
  },
  {
    level: 3,
    minDays: 10,
    title: "เพลิงชมพู-ม่วง",
    subtitle: "วินัยระดับ 10+ วัน ไฟเริ่มกลายร่าง!",
    badgeText: "Lv.3",
    accentTextClass: "text-fuchsia-600 dark:text-fuchsia-400",
    pillBorderClass:
      "border-fuchsia-400/80 shadow-[0_0_16px_rgba(217,70,239,0.22)] dark:border-fuchsia-600",
  },
  {
    level: 4,
    minDays: 30,
    title: "เปลวเพลิงสีฟ้า",
    subtitle: "ครบ 1 เดือนเต็ม! เปลวไฟอุณหภูมิสูงสุด",
    badgeText: "Lv.4",
    accentTextClass: "text-sky-600 dark:text-sky-400",
    pillBorderClass:
      "border-sky-400/90 shadow-[0_0_18px_rgba(14,165,233,0.28)] dark:border-sky-500",
  },
  {
    level: 5,
    minDays: 100,
    title: "มรกตทองคำ",
    subtitle: "ระดับ 100 วัน! มงกุฎมรกตแห่ง MoneyFlow",
    badgeText: "Lv.5",
    accentTextClass: "text-emerald-600 dark:text-emerald-400",
    pillBorderClass:
      "border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] dark:border-emerald-500",
  },
  {
    level: 6,
    minDays: 200,
    title: "เพลิงตำนาน",
    subtitle: "ทะลุ 200 วัน! ร่างสูงสุดระดับตำนาน",
    badgeText: "Lv.6",
    accentTextClass: "text-violet-600 dark:text-violet-300",
    pillBorderClass:
      "border-violet-400 shadow-[0_0_22px_rgba(168,85,247,0.35)] dark:border-violet-500",
  },
] as const;

const EVOLUTION_MILESTONE_DAYS = new Set([3, 10, 30, 100, 200]);

export interface StreakEvolutionInfo {
  currentTier: StreakEvolutionTier;
  nextTier: StreakEvolutionTier | null;
  daysToNextTier: number;
  progressToNextPct: number;
  justEvolvedToday: boolean;
  unlockedMaxLevel: StreakEvolutionTier["level"];
}

export function getStreakTierForDays(days: number): StreakEvolutionTier {
  const safeDays = Math.max(0, Math.floor(days));
  let matched = STREAK_EVOLUTION_TIERS[0];
  for (const tier of STREAK_EVOLUTION_TIERS) {
    if (safeDays >= tier.minDays) {
      matched = tier;
    }
  }
  return matched;
}

export function getStreakEvolutionInfo(
  streak: StreakSummary
): StreakEvolutionInfo {
  const currentTier = getStreakTierForDays(streak.currentStreak);
  const nextTier =
    STREAK_EVOLUTION_TIERS.find(
      (tier) => tier.level === currentTier.level + 1
    ) ?? null;

  const daysToNextTier = nextTier
    ? Math.max(0, nextTier.minDays - streak.currentStreak)
    : 0;

  let progressToNextPct = 100;
  if (nextTier) {
    const span = Math.max(1, nextTier.minDays - currentTier.minDays);
    const covered = Math.max(0, streak.currentStreak - currentTier.minDays);
    progressToNextPct = Math.min(100, Math.round((covered / span) * 100));
  }

  const justEvolvedToday =
    streak.recordedToday && EVOLUTION_MILESTONE_DAYS.has(streak.currentStreak);

  const unlockedMaxLevel = getStreakTierForDays(
    Math.max(streak.longestStreak, streak.currentStreak)
  ).level;

  return {
    currentTier,
    nextTier,
    daysToNextTier,
    progressToNextPct,
    justEvolvedToday,
    unlockedMaxLevel,
  };
}

export function getBangkokCountdownToMidnight(now: Date = new Date()): {
  hours: number;
  minutes: number;
  label: string;
} {
  // Asia/Bangkok is permanently UTC+7 (no DST).
  const bangkokMs = now.getTime() + 7 * 3_600_000;
  const bangkokDate = new Date(bangkokMs);
  const elapsedMinutes =
    bangkokDate.getUTCHours() * 60 + bangkokDate.getUTCMinutes();
  const remainingMinutes = Math.max(1, 24 * 60 - elapsedMinutes);
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;

  return {
    hours,
    minutes,
    label: `${hours} ชม. ${minutes} นาที`,
  };
}
