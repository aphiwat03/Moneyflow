import { describe, expect, it } from "vitest";
import {
  computeRecordingStreak,
  getBangkokCountdownToMidnight,
  getStreakEvolutionInfo,
  getStreakTierForDays,
} from "@/lib/streak";

describe("computeRecordingStreak", () => {
  it("counts consecutive days up to today and deduplicates multiple entries per day", () => {
    const result = computeRecordingStreak(
      ["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-19"],
      "2026-11-19"
    );

    expect(result).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      totalRecordedDays: 3,
      recordedToday: true,
      atRisk: false,
      lastRecordedDate: "2026-11-19",
    });
  });

  it("marks streak as atRisk when recorded yesterday but not yet today", () => {
    const result = computeRecordingStreak(
      ["2026-11-16", "2026-11-17", "2026-11-18"],
      "2026-11-19"
    );

    expect(result).toEqual({
      currentStreak: 3,
      longestStreak: 3,
      totalRecordedDays: 3,
      recordedToday: false,
      atRisk: true,
      lastRecordedDate: "2026-11-18",
    });
  });

  it("resets currentStreak when gap exceeds 1 day while keeping longestStreak", () => {
    const result = computeRecordingStreak(
      [
        "2026-11-01",
        "2026-11-02",
        "2026-11-03",
        "2026-11-04",
        "2026-11-10",
        "2026-11-17",
      ],
      "2026-11-19"
    );

    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 4,
      totalRecordedDays: 6,
      recordedToday: false,
      atRisk: false,
      lastRecordedDate: "2026-11-17",
    });
  });

  it("ignores future-dated transactions and handles empty input", () => {
    expect(computeRecordingStreak([], "2026-11-19")).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      totalRecordedDays: 0,
      recordedToday: false,
      atRisk: false,
      lastRecordedDate: null,
    });

    const withFuture = computeRecordingStreak(
      ["2026-11-19", "2026-11-25", "invalid-date"],
      "2026-11-19"
    );
    expect(withFuture).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      totalRecordedDays: 1,
      recordedToday: true,
      atRisk: false,
      lastRecordedDate: "2026-11-19",
    });
  });
});

describe("getStreakTierForDays & getStreakEvolutionInfo", () => {
  it("maps every streak boundary across Lv.0 through Lv.6 accurately", () => {
    expect(getStreakTierForDays(0).level).toBe(0);
    expect(getStreakTierForDays(1).level).toBe(1);
    expect(getStreakTierForDays(2).level).toBe(1);
    expect(getStreakTierForDays(3).level).toBe(2);
    expect(getStreakTierForDays(9).level).toBe(2);
    expect(getStreakTierForDays(10).level).toBe(3);
    expect(getStreakTierForDays(29).level).toBe(3);
    expect(getStreakTierForDays(30).level).toBe(4);
    expect(getStreakTierForDays(99).level).toBe(4);
    expect(getStreakTierForDays(100).level).toBe(5);
    expect(getStreakTierForDays(199).level).toBe(5);
    expect(getStreakTierForDays(200).level).toBe(6);
    expect(getStreakTierForDays(365).level).toBe(6);
  });

  it("computes progress, unlockedMaxLevel, and justEvolvedToday flags", () => {
    const evolved = getStreakEvolutionInfo({
      currentStreak: 10,
      longestStreak: 30,
      totalRecordedDays: 40,
      recordedToday: true,
      atRisk: false,
      lastRecordedDate: "2026-11-19",
    });

    expect(evolved.currentTier.level).toBe(3);
    expect(evolved.nextTier?.level).toBe(4);
    expect(evolved.daysToNextTier).toBe(20);
    expect(evolved.progressToNextPct).toBe(0);
    expect(evolved.justEvolvedToday).toBe(true);
    expect(evolved.unlockedMaxLevel).toBe(4);

    const maxLevel = getStreakEvolutionInfo({
      currentStreak: 220,
      longestStreak: 220,
      totalRecordedDays: 220,
      recordedToday: true,
      atRisk: false,
      lastRecordedDate: "2026-11-19",
    });
    expect(maxLevel.nextTier).toBeNull();
    expect(maxLevel.daysToNextTier).toBe(0);
    expect(maxLevel.progressToNextPct).toBe(100);
    expect(maxLevel.justEvolvedToday).toBe(false);
  });

  it("calculates Asia/Bangkok countdown to midnight accurately", () => {
    // 2026-11-19T14:45:00Z == 21:45 Asia/Bangkok -> 2h 15m left until 24:00
    const sample = new Date("2026-11-19T14:45:00.000Z");
    expect(getBangkokCountdownToMidnight(sample)).toEqual({
      hours: 2,
      minutes: 15,
      label: "2 ชม. 15 นาที",
    });
  });
});
