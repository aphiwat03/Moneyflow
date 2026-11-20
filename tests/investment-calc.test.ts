import { describe, expect, it } from "vitest";
import {
  applyDcaPurchaseMath,
  buildInvestmentProjection,
  buildMonthlyDcaChecklist,
  computeInvestmentPortfolioSummary,
  computeRequiredMonthlyDca,
  computeUnitMarketValueThb,
  computeWeightedExpectedReturn,
  DEFAULT_INVESTMENT_HOLDINGS,
  DEFAULT_INVESTMENT_SETTINGS,
  formatMonthsToYearsThai,
  reverseDcaPurchaseMath,
} from "@/lib/investment-calc";
import {
  isSupportedMarketTicker,
  normalizeMarketSymbol,
} from "@/lib/investment-prices";

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

  it("builds monthly DCA checklist status (pending, partial, done) for target month only", () => {
    const settings = {
      ...DEFAULT_INVESTMENT_SETTINGS,
      monthlyDca: "5000.00",
    };
    const holdings = [
      { ...DEFAULT_INVESTMENT_HOLDINGS[0], id: "h-voo", targetAllocationPct: 60 }, // planned 3000
      { ...DEFAULT_INVESTMENT_HOLDINGS[1], id: "h-schd", targetAllocationPct: 25 }, // planned 1250
      { ...DEFAULT_INVESTMENT_HOLDINGS[2], id: "h-gold", targetAllocationPct: 15 }, // planned 750
    ];
    const logs = [
      {
        id: "l1",
        holdingId: "h-voo",
        holdingSymbol: "VOO",
        holdingName: "Vanguard S&P 500 ETF",
        transactionId: null,
        executedDate: "2026-11-05",
        amountThb: "3000.00",
        unitsBought: "0.150000",
        pricePerUnit: null,
        feeThb: "0.00",
        note: null,
      },
      {
        id: "l2",
        holdingId: "h-schd",
        holdingSymbol: "SCHD",
        holdingName: "Schwab US Dividend Equity ETF",
        transactionId: null,
        executedDate: "2026-11-10",
        amountThb: "500.00",
        unitsBought: null,
        pricePerUnit: null,
        feeThb: "0.00",
        note: null,
      },
      // Previous month log must be ignored for 2026-11
      {
        id: "l3",
        holdingId: "h-gold",
        holdingSymbol: "GOLD",
        holdingName: "Gold",
        transactionId: null,
        executedDate: "2026-10-25",
        amountThb: "750.00",
        unitsBought: null,
        pricePerUnit: null,
        feeThb: "0.00",
        note: null,
      },
    ];

    const checklist = buildMonthlyDcaChecklist(
      holdings,
      settings,
      logs,
      "2026-11"
    );

    expect(checklist.totalPlannedThb).toBe("5000.00");
    expect(checklist.totalBoughtThb).toBe("3500.00");
    expect(checklist.completedCount).toBe(1);
    expect(checklist.totalCount).toBe(3);
    expect(checklist.items[0].status).toBe("done");
    expect(checklist.items[0].remainingAmountThb).toBe("0.00");
    expect(checklist.items[1].status).toBe("partial");
    expect(checklist.items[1].remainingAmountThb).toBe("750.00");
    expect(checklist.items[2].status).toBe("pending");
    expect(checklist.items[2].remainingAmountThb).toBe("750.00");
  });

  it("updates and reverses DCA cost basis and units accurately without negatives", () => {
    const bought = applyDcaPurchaseMath({
      currentInvestedCost: "10000.00",
      currentValue: "11200.00",
      currentUnits: "1.250000",
      amountThb: "3000.00",
      unitsBought: "0.35",
    });
    expect(bought).toEqual({
      nextInvestedCost: "13000.00",
      nextCurrentValue: "14200.00",
      nextUnits: "1.600000",
    });

    const undone = reverseDcaPurchaseMath({
      currentInvestedCost: bought.nextInvestedCost,
      currentValue: bought.nextCurrentValue,
      currentUnits: bought.nextUnits,
      amountThb: "3000.00",
      unitsBought: "0.35",
    });
    expect(undone).toEqual({
      nextInvestedCost: "10000.00",
      nextCurrentValue: "11200.00",
      nextUnits: "1.250000",
    });

    const floorZero = reverseDcaPurchaseMath({
      currentInvestedCost: "100.00",
      currentValue: "50.00",
      currentUnits: "0.100000",
      amountThb: "500.00",
      unitsBought: "0.50",
    });
    expect(floorZero).toEqual({
      nextInvestedCost: "0.00",
      nextCurrentValue: "0.00",
      nextUnits: null,
    });
  });

  it("converts USD & THB market unit prices to THB and filters supported tickers", () => {
    expect(
      computeUnitMarketValueThb({
        units: "2.5",
        unitPrice: 500,
        currency: "USD",
        usdThbRate: 34.5,
      })
    ).toBe("43125.00");

    expect(
      computeUnitMarketValueThb({
        units: "100",
        unitPrice: 32.25,
        currency: "THB",
      })
    ).toBe("3225.00");

    expect(normalizeMarketSymbol(" voo ")).toBe("VOO");
    expect(isSupportedMarketTicker("VOO", "etf")).toBe(true);
    expect(isSupportedMarketTicker("PTT.BK", "stock")).toBe(true);
    expect(isSupportedMarketTicker("BRK-B", "stock")).toBe(true);
    expect(isSupportedMarketTicker("SCBS&P500", "mutual_fund")).toBe(false);
    expect(isSupportedMarketTicker("GOLD", "gold_bond")).toBe(false);
  });
});
