import { describe, expect, it } from "vitest";
import {
  formatIsoDateForDisplay,
  getBangkokCurrentMonthRange,
  getBangkokPreviousMonthRange,
  getBangkokToday,
  getMonthDateRange,
  getPaydayCycleDateRange,
  isValidIsoCalendarDate,
} from "@/lib/date";

describe("date helpers (Asia/Bangkok)", () => {
  it("resolves midnight UTC drift accurately in Asia/Bangkok (+7)", () => {
    // 2026-11-16 17:30:00Z = 2026-11-17 00:30:00 ICT
    const ictEarlyMorning = new Date("2026-11-16T17:30:00.000Z");
    expect(getBangkokToday(ictEarlyMorning)).toBe("2026-11-17");

    // 2026-11-16 16:59:59Z = 2026-11-16 23:59:59 ICT
    const ictLateNight = new Date("2026-11-16T16:59:59.000Z");
    expect(getBangkokToday(ictLateNight)).toBe("2026-11-16");
  });

  it("computes leap year February and standard month ranges accurately", () => {
    expect(getMonthDateRange(2024, 2)).toEqual({
      startDate: "2024-02-01",
      endDate: "2024-02-29",
    });
    expect(getMonthDateRange(2026, 2)).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });

  it("handles year rollover when getting current and previous month ranges", () => {
    // 2026-12-31 18:00:00Z = 2027-01-01 01:00:00 ICT
    const bangkokNewYear = new Date("2026-12-31T18:00:00.000Z");
    expect(getBangkokCurrentMonthRange(bangkokNewYear)).toEqual({
      year: 2027,
      month: 1,
      startDate: "2027-01-01",
      endDate: "2027-01-31",
    });
    expect(getBangkokPreviousMonthRange(bangkokNewYear)).toEqual({
      year: 2026,
      month: 12,
      startDate: "2026-12-01",
      endDate: "2026-12-31",
    });
  });

  it("validates calendar dates properly", () => {
    expect(isValidIsoCalendarDate("2026-11-16")).toBe(true);
    expect(isValidIsoCalendarDate("2026-02-29")).toBe(false);
    expect(isValidIsoCalendarDate("2026-13-01")).toBe(false);
    expect(isValidIsoCalendarDate("16-11-2026")).toBe(false);
  });

  it("formats ISO dates consistently without timezone shifts", () => {
    const formatted = formatIsoDateForDisplay("2026-11-16", "en-US");
    expect(formatted).toContain("Nov");
    expect(formatted).toContain("16");
    expect(formatted).toContain("2026");
  });

  it("computes payday cycle date ranges across standard, mid-month, late-month, and February clamping", () => {
    expect(getPaydayCycleDateRange(2026, 11, 1)).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      totalDays: 30,
    });
    expect(getPaydayCycleDateRange(2026, 11, 25)).toEqual({
      startDate: "2026-10-25",
      endDate: "2026-11-24",
      totalDays: 31,
    });
    expect(getPaydayCycleDateRange(2026, 11, 5)).toEqual({
      startDate: "2026-11-05",
      endDate: "2026-12-04",
      totalDays: 30,
    });
    expect(getPaydayCycleDateRange(2026, 3, 31)).toEqual({
      startDate: "2026-02-28",
      endDate: "2026-03-30",
      totalDays: 31,
    });
  });
});
