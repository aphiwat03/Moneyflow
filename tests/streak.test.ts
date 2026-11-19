import { describe, expect, it } from "vitest";
import { computeRecordingStreak } from "@/lib/streak";

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
