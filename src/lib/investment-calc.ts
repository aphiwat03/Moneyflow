import Decimal from "decimal.js";
import { formatFixed2, toChartNumber, toDecimal } from "./decimal";
import type {
  ComputedInvestmentHolding,
  InvestmentAssetType,
  InvestmentHoldingDTO,
  InvestmentPlanSettingsDTO,
  InvestmentPortfolioSummary,
  InvestmentProjectionPoint,
  InvestmentProjectionSummary,
} from "./types";

export const INVESTMENT_ASSET_TYPE_META: Record<
  InvestmentAssetType,
  { label: string; shortLabel: string; defaultColor: string }
> = {
  etf: {
    label: "ETF / ดัชนีต่างประเทศ",
    shortLabel: "ETF",
    defaultColor: "#0f766e",
  },
  stock: {
    label: "หุ้นรายตัว (ไทย / ต่างประเทศ)",
    shortLabel: "หุ้นรายตัว",
    defaultColor: "#3b82f6",
  },
  mutual_fund: {
    label: "กองทุนรวม (RMF / SSF / ทั่วไป)",
    shortLabel: "กองทุนรวม",
    defaultColor: "#10b981",
  },
  gold_bond: {
    label: "ทองคำ / ตราสารหนี้",
    shortLabel: "ทองคำ/ตราสาร",
    defaultColor: "#f59e0b",
  },
  other: {
    label: "สินทรัพย์ทางเลือกอื่นๆ",
    shortLabel: "อื่นๆ",
    defaultColor: "#8b5cf6",
  },
};

export interface InvestmentHoldingPreset {
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  targetAllocationPct: number;
  expectedAnnualReturnPct: number;
  broker: string;
  note: string;
  color: string;
}

export const POPULAR_DCA_PRESETS: InvestmentHoldingPreset[] = [
  {
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    assetType: "etf",
    targetAllocationPct: 60,
    expectedAnnualReturnPct: 9.0,
    broker: "Dime / InnovestX",
    note: "หุ้นสหรัฐฯ 500 บริษัทใหญ่ เหมาะเป็นแกนหลัก DCA ระยะยาว",
    color: "#0f766e",
  },
  {
    symbol: "SCHD",
    name: "Schwab US Dividend Equity ETF",
    assetType: "etf",
    targetAllocationPct: 25,
    expectedAnnualReturnPct: 7.5,
    broker: "Dime / InnovestX",
    note: "เน้นหุ้นปันผลเติบโตสม่ำเสมอ ลดความผันผวน",
    color: "#10b981",
  },
  {
    symbol: "QQQM",
    name: "Invesco NASDAQ 100 ETF",
    assetType: "etf",
    targetAllocationPct: 25,
    expectedAnnualReturnPct: 10.5,
    broker: "Dime / InnovestX",
    note: "หุ้นเทคโนโลยีเติบโตสูง ความผันผวนสูงกว่าตลาด",
    color: "#3b82f6",
  },
  {
    symbol: "VT",
    name: "Vanguard Total World Stock ETF",
    assetType: "etf",
    targetAllocationPct: 100,
    expectedAnnualReturnPct: 7.5,
    broker: "Dime / InnovestX",
    note: "กระจายลงทุนหุ้นทั่วโลกในตัวเดียว",
    color: "#0ea5e9",
  },
  {
    symbol: "SCBS&P500",
    name: "กองทุนเปิดไทยพาณิชย์ หุ้นยูเอส (S&P 500)",
    assetType: "mutual_fund",
    targetAllocationPct: 50,
    expectedAnnualReturnPct: 8.5,
    broker: "SCB Easy / Finnomena",
    note: "กองทุนรวมไทยอ้างอิง S&P 500 ซื้อเป็นเงินบาทได้เลย",
    color: "#8b5cf6",
  },
  {
    symbol: "GOLD",
    name: "กองทุนทองคำ / ออมทองระยะยาว",
    assetType: "gold_bond",
    targetAllocationPct: 15,
    expectedAnnualReturnPct: 5.5,
    broker: "Gold Now / Finnomena",
    note: "สินทรัพย์ปลอดภัย ช่วยกระจายความเสี่ยงพอร์ต",
    color: "#f59e0b",
  },
];

export const DEFAULT_INVESTMENT_SETTINGS: InvestmentPlanSettingsDTO = {
  targetGoalAmount: "2000000.00",
  startingPrincipal: "0.00",
  monthlyDca: "3000.00",
  expectedAnnualReturnPct: 8,
  horizonYears: 15,
  annualDcaStepUpPct: 0,
  reinvestDividends: true,
};

export const DEFAULT_INVESTMENT_HOLDINGS: InvestmentHoldingDTO[] = [
  {
    id: "preset-voo",
    symbol: "VOO",
    name: "Vanguard S&P 500 ETF",
    assetType: "etf",
    targetAllocationPct: 60,
    expectedAnnualReturnPct: 9.0,
    investedCost: "0.00",
    currentValue: "0.00",
    dividendsReceived: "0.00",
    broker: "Dime / InnovestX",
    note: "พอร์ตแกนหลัก DCA ระยะยาว (ยังไม่ได้เริ่มซื้อจริง)",
    color: "#0f766e",
  },
  {
    id: "preset-schd",
    symbol: "SCHD",
    name: "Schwab US Dividend Equity ETF",
    assetType: "etf",
    targetAllocationPct: 25,
    expectedAnnualReturnPct: 7.5,
    investedCost: "0.00",
    currentValue: "0.00",
    dividendsReceived: "0.00",
    broker: "Dime / InnovestX",
    note: "หุ้นปันผลคุณภาพดี เก็บกระแสเงินสดระยะยาว",
    color: "#10b981",
  },
  {
    id: "preset-gold",
    symbol: "GOLD",
    name: "ทองคำ / ตราสารหนี้กระจายเสี่ยง",
    assetType: "gold_bond",
    targetAllocationPct: 15,
    expectedAnnualReturnPct: 5.5,
    investedCost: "0.00",
    currentValue: "0.00",
    dividendsReceived: "0.00",
    broker: "Gold Now / กองทุนรวม",
    note: "กันชนลดความผันผวนของพอร์ตหุ้น",
    color: "#f59e0b",
  },
];

export function computeWeightedExpectedReturn(
  holdings: InvestmentHoldingDTO[],
  fallbackReturnPct = 8
): number {
  if (holdings.length === 0) return fallbackReturnPct;

  const totalTargetPct = holdings.reduce(
    (sum, h) => sum + Math.max(0, h.targetAllocationPct),
    0
  );

  if (totalTargetPct > 0) {
    const weighted = holdings.reduce(
      (sum, h) =>
        sum + Math.max(0, h.targetAllocationPct) * h.expectedAnnualReturnPct,
      0
    );
    return Number((weighted / totalTargetPct).toFixed(2));
  }

  const totalVal = holdings.reduce(
    (sum, h) => sum.plus(Decimal.max(0, toDecimal(h.currentValue))),
    new Decimal(0)
  );
  if (totalVal.gt(0)) {
    const weighted = holdings.reduce(
      (sum, h) =>
        sum.plus(
          Decimal.max(0, toDecimal(h.currentValue)).times(
            h.expectedAnnualReturnPct
          )
        ),
      new Decimal(0)
    );
    return Number(weighted.div(totalVal).toDecimalPlaces(2).toNumber());
  }

  const avg =
    holdings.reduce((sum, h) => sum + h.expectedAnnualReturnPct, 0) /
    holdings.length;
  return Number(avg.toFixed(2));
}

export function computeRequiredMonthlyDca(params: {
  targetGoalAmount: string;
  startingPrincipal: string;
  expectedAnnualReturnPct: number;
  horizonYears: number;
}): string {
  const goal = Decimal.max(0, toDecimal(params.targetGoalAmount));
  const principal = Decimal.max(0, toDecimal(params.startingPrincipal));
  const months = Math.max(1, Math.round(params.horizonYears * 12));
  const annualRate = Math.max(0, params.expectedAnnualReturnPct) / 100;

  if (goal.lte(principal)) {
    return "0.00";
  }

  if (annualRate === 0) {
    return formatFixed2(
      goal.minus(principal).div(months).toDecimalPlaces(2, Decimal.ROUND_CEIL)
    );
  }

  const r = new Decimal(annualRate).div(12);
  const growthFactor = r.plus(1).pow(months);
  const futurePrincipal = principal.times(growthFactor);

  if (futurePrincipal.gte(goal)) {
    return "0.00";
  }

  const remainingGoal = goal.minus(futurePrincipal);
  const annuityFactor = growthFactor.minus(1).div(r);
  const requiredPmt = remainingGoal
    .div(annuityFactor)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL);

  return formatFixed2(Decimal.max(0, requiredPmt));
}

export function buildInvestmentProjection(
  settings: InvestmentPlanSettingsDTO,
  baseGregorianYear = new Date().getFullYear()
): InvestmentProjectionSummary {
  const goalDec = Decimal.max(0, toDecimal(settings.targetGoalAmount));
  const startDec = Decimal.max(0, toDecimal(settings.startingPrincipal));
  const initialMonthlyDca = Decimal.max(0, toDecimal(settings.monthlyDca));
  const annualReturnPct = Math.max(0, Math.min(50, settings.expectedAnnualReturnPct));
  const horizonYears = Math.max(1, Math.min(40, Math.round(settings.horizonYears)));
  const stepUpPct = Math.max(0, Math.min(30, settings.annualDcaStepUpPct));

  const monthlyRate = new Decimal(annualReturnPct).div(100).div(12);
  const stepUpMultiplier = new Decimal(1).plus(new Decimal(stepUpPct).div(100));
  const baseBuddhistYear = baseGregorianYear + 543;
  const targetGoalNum = toChartNumber(goalDec);

  const points: InvestmentProjectionPoint[] = [
    {
      yearIndex: 0,
      buddhistYear: baseBuddhistYear,
      label: `ปัจจุบัน`,
      contributed: toChartNumber(startDec),
      projectedValue: toChartNumber(startDec),
      compoundGain: 0,
      targetGoal: targetGoalNum,
    },
  ];

  let balance = new Decimal(startDec);
  let contributed = new Decimal(startDec);
  let currentDca = new Decimal(initialMonthlyDca);
  let monthsToGoal: number | null =
    goalDec.gt(0) && startDec.gte(goalDec) ? 0 : null;

  const maxSearchMonths = Math.max(horizonYears * 12, 600); // search up to 50 years

  let finalValueDec = new Decimal(startDec);
  let finalContributedDec = new Decimal(startDec);

  for (let m = 1; m <= maxSearchMonths; m++) {
    if (m > 1 && (m - 1) % 12 === 0 && stepUpPct > 0) {
      currentDca = currentDca.times(stepUpMultiplier);
    }

    balance = balance.times(monthlyRate.plus(1)).plus(currentDca);
    contributed = contributed.plus(currentDca);

    if (monthsToGoal === null && goalDec.gt(0) && balance.gte(goalDec)) {
      monthsToGoal = m;
    }

    if (m <= horizonYears * 12 && m % 12 === 0) {
      const yearIndex = m / 12;
      const gain = Decimal.max(0, balance.minus(contributed));
      points.push({
        yearIndex,
        buddhistYear: baseBuddhistYear + yearIndex,
        label: `ปีที่ ${yearIndex}`,
        contributed: toChartNumber(contributed),
        projectedValue: toChartNumber(balance),
        compoundGain: toChartNumber(gain),
        targetGoal: targetGoalNum,
      });

      if (yearIndex === horizonYears) {
        finalValueDec = new Decimal(balance);
        finalContributedDec = new Decimal(contributed);
      }
    }

    // Early exit once we passed both the requested horizon and found the goal
    if (m >= horizonYears * 12 && (monthsToGoal !== null || goalDec.lte(0))) {
      break;
    }
  }

  const finalGainDec = Decimal.max(0, finalValueDec.minus(finalContributedDec));
  const finalGainPct = finalContributedDec.gt(0)
    ? finalGainDec
        .div(finalContributedDec)
        .times(100)
        .toDecimalPlaces(1)
        .toNumber()
    : 0;

  const goalProgressPct = goalDec.gt(0)
    ? Math.min(
        100,
        Math.max(
          0,
          startDec.div(goalDec).times(100).toDecimalPlaces(1).toNumber()
        )
      )
    : 0;

  const targetBuddhistYear =
    monthsToGoal !== null
      ? baseBuddhistYear + Math.ceil(monthsToGoal / 12)
      : null;

  const requiredMonthlyDcaForHorizon = computeRequiredMonthlyDca({
    targetGoalAmount: settings.targetGoalAmount,
    startingPrincipal: settings.startingPrincipal,
    expectedAnnualReturnPct: annualReturnPct,
    horizonYears,
  });

  return {
    points,
    finalValue: formatFixed2(finalValueDec),
    finalContributed: formatFixed2(finalContributedDec),
    finalGain: formatFixed2(finalGainDec),
    finalGainPct,
    goalProgressPct,
    monthsToGoal,
    targetBuddhistYear,
    requiredMonthlyDcaForHorizon,
  };
}

export function computeInvestmentPortfolioSummary(
  holdings: InvestmentHoldingDTO[],
  settings: InvestmentPlanSettingsDTO
): InvestmentPortfolioSummary {
  const monthlyDcaDec = Decimal.max(0, toDecimal(settings.monthlyDca));
  const totalTargetAllocationPct = Number(
    holdings
      .reduce((sum, h) => sum + Math.max(0, h.targetAllocationPct), 0)
      .toFixed(1)
  );

  const totalInvestedCostDec = holdings.reduce(
    (sum, h) => sum.plus(Decimal.max(0, toDecimal(h.investedCost))),
    new Decimal(0)
  );
  const totalCurrentValueDec = holdings.reduce(
    (sum, h) => sum.plus(Decimal.max(0, toDecimal(h.currentValue))),
    new Decimal(0)
  );
  const totalDividendsDec = holdings.reduce(
    (sum, h) => sum.plus(Decimal.max(0, toDecimal(h.dividendsReceived))),
    new Decimal(0)
  );

  const computedHoldings: ComputedInvestmentHolding[] = holdings.map((h) => {
    const cost = Decimal.max(0, toDecimal(h.investedCost));
    const current = Decimal.max(0, toDecimal(h.currentValue));
    const divs = Decimal.max(0, toDecimal(h.dividendsReceived));
    const unrealizedGain = current.minus(cost);
    const unrealizedGainPct = cost.gt(0)
      ? unrealizedGain.div(cost).times(100).toDecimalPlaces(2).toNumber()
      : 0;
    const totalReturnWithDividends = unrealizedGain.plus(divs);
    const totalReturnPct = cost.gt(0)
      ? totalReturnWithDividends
          .div(cost)
          .times(100)
          .toDecimalPlaces(2)
          .toNumber()
      : 0;
    const actualWeightPct = totalCurrentValueDec.gt(0)
      ? current
          .div(totalCurrentValueDec)
          .times(100)
          .toDecimalPlaces(1)
          .toNumber()
      : 0;
    const monthlyDcaAmount = monthlyDcaDec
      .times(Math.max(0, h.targetAllocationPct))
      .div(100)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      ...h,
      monthlyDcaAmount: formatFixed2(monthlyDcaAmount),
      unrealizedGain: formatFixed2(unrealizedGain),
      unrealizedGainPct,
      totalReturnWithDividends: formatFixed2(totalReturnWithDividends),
      totalReturnPct,
      actualWeightPct,
    };
  });

  const totalUnrealizedGainDec = totalCurrentValueDec.minus(totalInvestedCostDec);
  const totalUnrealizedGainPct = totalInvestedCostDec.gt(0)
    ? totalUnrealizedGainDec
        .div(totalInvestedCostDec)
        .times(100)
        .toDecimalPlaces(2)
        .toNumber()
    : 0;
  const totalReturnWithDividendsDec =
    totalUnrealizedGainDec.plus(totalDividendsDec);
  const totalReturnWithDividendsPct = totalInvestedCostDec.gt(0)
    ? totalReturnWithDividendsDec
        .div(totalInvestedCostDec)
        .times(100)
        .toDecimalPlaces(2)
        .toNumber()
    : 0;

  return {
    holdings: computedHoldings,
    totalTargetAllocationPct,
    weightedExpectedReturnPct: computeWeightedExpectedReturn(
      holdings,
      settings.expectedAnnualReturnPct
    ),
    totalInvestedCost: formatFixed2(totalInvestedCostDec),
    totalCurrentValue: formatFixed2(totalCurrentValueDec),
    totalDividends: formatFixed2(totalDividendsDec),
    totalUnrealizedGain: formatFixed2(totalUnrealizedGainDec),
    totalUnrealizedGainPct,
    totalReturnWithDividends: formatFixed2(totalReturnWithDividendsDec),
    totalReturnWithDividendsPct,
    hasRealTrackingData:
      totalInvestedCostDec.gt(0) ||
      totalCurrentValueDec.gt(0) ||
      totalDividendsDec.gt(0),
  };
}

export function formatMonthsToYearsThai(months: number | null): string {
  if (months === null) return "มากกว่า 50 ปี";
  if (months === 0) return "ถึงเป้าหมายแล้ว!";
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths} เดือน`;
  if (remMonths === 0) return `${years} ปี`;
  return `${years} ปี ${remMonths} เดือน`;
}
