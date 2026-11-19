import { describe, expect, it } from "vitest";
import {
  buildInvestmentProjection,
  computeInvestmentPortfolioSummary,
  computeRequiredMonthlyDca,
  computeWeightedExpectedReturn,
  DEFAULT_INVESTMENT_HOLDINGS,
  DEFAULT_INVESTMENT_SETTINGS,
  formatMonthsToYearsThai,
} from "@/lib/investment-calc";

describe("investment-calc", () => {
  it("computes compound growth projection and months to reach 2M target", () => {
    const result = buildInvestmentProjection(
      {
        ...DEFAULT_INVESTMENT_SETTINGS,
        targetGoalAmount: "2000000.00",
        startingPrincipal: "0.00",
        monthlyDca: "5000.00",
        expectedAnnualReturnPct: 8,
        horizonYears: 20,
        annualDcaStepUpPct: 0,
      },
      2026
    );

    expect(result.points).toHaveLength(21); // Year 0 .. Year 20
    expect(result.finalContributed).toBe("1200000.00");
    // 5000/mo @ 8% compounded monthly for 20 years ≈ 2,945,102.08
    expect(Number(result.finalValue)).toBeGreaterThan(2_900_000);
    expect(Number(result.finalGain)).toBeGreaterThan(1_700_000);
    expect(result.monthsToGoal).not.toBeNull();
    expect(result.monthsToGoal!).toBeGreaterThan(180); // > 15 years
    expect(result.monthsToGoal!).toBeLessThan(216); // < 18 years
    expect(result.targetBuddhistYear).toBeGreaterThan(2569);
  });

  it("handles 0% return cleanly for projection and required monthly DCA", () => {
    const req = computeRequiredMonthlyDca({
      targetGoalAmount: "120000.00",
      startingPrincipal: "0.00",
      expectedAnnualReturnPct: 0,
      horizonYears: 10,
    });
    expect(req).toBe("1000.00");

    const proj = buildInvestmentProjection(
      {
        ...DEFAULT_INVESTMENT_SETTINGS,
        targetGoalAmount: "120000.00",
        startingPrincipal: "0.00",
        monthlyDca: "1000.00",
        expectedAnnualReturnPct: 0,
        horizonYears: 10,
        annualDcaStepUpPct: 0,
      },
      2026
    );
    expect(proj.finalValue).toBe("120000.00");
    expect(proj.finalGain).toBe("0.00");
    expect(proj.monthsToGoal).toBe(120);
  });

  it("computes weighted expected return across target allocation percentages", () => {
    // 60% * 9.0 + 25% * 7.5 + 15% * 5.5 = 5.4 + 1.875 + 0.825 = 8.10%
    const weighted = computeWeightedExpectedReturn(DEFAULT_INVESTMENT_HOLDINGS);
    expect(weighted).toBe(8.1);
  });

  it("computes portfolio DCA split and real P&L tracking accurately", () => {
    const holdings = [
      {
        ...DEFAULT_INVESTMENT_HOLDINGS[0],
        targetAllocationPct: 60,
        investedCost: "10000.00",
        currentValue: "11500.00",
        dividendsReceived: "300.00",
      },
      {
        ...DEFAULT_INVESTMENT_HOLDINGS[1],
        targetAllocationPct: 40,
        investedCost: "5000.00",
        currentValue: "4750.00",
        dividendsReceived: "200.00",
      },
    ];

    const summary = computeInvestmentPortfolioSummary(holdings, {
      ...DEFAULT_INVESTMENT_SETTINGS,
      monthlyDca: "5000.00",
    });

    expect(summary.totalTargetAllocationPct).toBe(100);
    expect(summary.hasRealTrackingData).toBe(true);
    expect(summary.totalInvestedCost).toBe("15000.00");
    expect(summary.totalCurrentValue).toBe("16250.00");
    expect(summary.totalDividends).toBe("500.00");
    expect(summary.totalUnrealizedGain).toBe("1250.00");
    expect(summary.totalReturnWithDividends).toBe("1750.00");
    expect(summary.holdings[0].monthlyDcaAmount).toBe("3000.00");
    expect(summary.holdings[1].monthlyDcaAmount).toBe("2000.00");
  });

  it("formats months to Thai duration cleanly", () => {
    expect(formatMonthsToYearsThai(null)).toBe("มากกว่า 50 ปี");
    expect(formatMonthsToYearsThai(0)).toBe("ถึงเป้าหมายแล้ว!");
    expect(formatMonthsToYearsThai(8)).toBe("8 เดือน");
    expect(formatMonthsToYearsThai(24)).toBe("2 ปี");
    expect(formatMonthsToYearsThai(29)).toBe("2 ปี 5 เดือน");
  });
});
