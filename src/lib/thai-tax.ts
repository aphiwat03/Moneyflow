import Decimal from "decimal.js";
import { formatFixed2, formatMoneyDisplay, toDecimal } from "./decimal";

export type TaxTier = "below_filing" | "filing_required_zero_tax" | "taxable";

export interface TaxEstimateSummary {
  annualIncome: string;
  expenseDeduction: string;
  personalAllowance: string;
  socialSecurityDeduction: string;
  netTaxableIncome: string;
  estimatedAnnualTax: string;
  estimatedMonthlyTaxReserve: string;
  marginalRatePct: number;
  headroomBeforeTaxable: string;
  tier: TaxTier;
}

export interface TaxToastAlert {
  kind: "success" | "warning";
  title: string;
  detail: string;
  tier: TaxTier;
}

const FILING_THRESHOLD_SALARY_ONLY = new Decimal(120_000);
const MAX_EXPENSE_DEDUCTION = new Decimal(100_000);
const PERSONAL_ALLOWANCE = new Decimal(60_000);
const SOCIAL_SECURITY_WAGE_CAP = new Decimal(15_000);
const SOCIAL_SECURITY_RATE = new Decimal("0.05");
const ZERO_TAX_NET_CEILING = new Decimal(150_000);

const THAI_TAX_BRACKETS: ReadonlyArray<{
  lower: number;
  upper: number | null;
  ratePct: number;
}> = [
  { lower: 0, upper: 150_000, ratePct: 0 },
  { lower: 150_000, upper: 300_000, ratePct: 5 },
  { lower: 300_000, upper: 500_000, ratePct: 10 },
  { lower: 500_000, upper: 750_000, ratePct: 15 },
  { lower: 750_000, upper: 1_000_000, ratePct: 20 },
  { lower: 1_000_000, upper: 2_000_000, ratePct: 25 },
  { lower: 2_000_000, upper: 5_000_000, ratePct: 30 },
  { lower: 5_000_000, upper: null, ratePct: 35 },
];

/**
 * Estimates Thai personal income tax (single filer, 40(1)/40(2) general approximation)
 * using exact Decimal.js arithmetic.
 */
export function estimateThaiPersonalIncomeTax(params: {
  annualIncome: string | number | Decimal;
  monthlySalary?: string | number | Decimal;
  includeSocialSecurity?: boolean;
}): TaxEstimateSummary {
  const annualDec = Decimal.max(0, toDecimal(params.annualIncome));
  const expenseDec = Decimal.min(
    annualDec.times("0.5"),
    MAX_EXPENSE_DEDUCTION
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  let socialSecurityDec = new Decimal(0);
  if (params.includeSocialSecurity !== false && params.monthlySalary !== undefined) {
    const monthlySalaryDec = Decimal.max(0, toDecimal(params.monthlySalary));
    if (monthlySalaryDec.gt(0)) {
      socialSecurityDec = Decimal.min(monthlySalaryDec, SOCIAL_SECURITY_WAGE_CAP)
        .times(SOCIAL_SECURITY_RATE)
        .times(12)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    }
  }

  const netTaxableDec = Decimal.max(
    0,
    annualDec
      .minus(expenseDec)
      .minus(PERSONAL_ALLOWANCE)
      .minus(socialSecurityDec)
  );

  let annualTaxDec = new Decimal(0);
  let marginalRatePct = 0;

  for (const bracket of THAI_TAX_BRACKETS) {
    if (netTaxableDec.lte(bracket.lower)) break;
    marginalRatePct = bracket.ratePct;
    if (bracket.ratePct === 0) continue;

    const taxableInBracket =
      bracket.upper === null
        ? netTaxableDec.minus(bracket.lower)
        : Decimal.min(netTaxableDec, bracket.upper).minus(bracket.lower);

    if (taxableInBracket.gt(0)) {
      annualTaxDec = annualTaxDec.plus(
        taxableInBracket.times(bracket.ratePct).div(100)
      );
    }
  }

  annualTaxDec = annualTaxDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const monthlyReserveDec = annualTaxDec
    .div(12)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL);

  // Gross annual threshold where netTaxableIncome reaches exactly 150,000 THB
  // (at gross >= 200,000, expense deduction is capped at 100,000).
  const grossTaxableStart = ZERO_TAX_NET_CEILING.plus(MAX_EXPENSE_DEDUCTION)
    .plus(PERSONAL_ALLOWANCE)
    .plus(socialSecurityDec);
  const headroomDec = Decimal.max(0, grossTaxableStart.minus(annualDec));

  let tier: TaxTier = "below_filing";
  if (annualTaxDec.gt(0)) {
    tier = "taxable";
  } else if (annualDec.gt(FILING_THRESHOLD_SALARY_ONLY)) {
    tier = "filing_required_zero_tax";
  }

  return {
    annualIncome: formatFixed2(annualDec),
    expenseDeduction: formatFixed2(expenseDec),
    personalAllowance: formatFixed2(PERSONAL_ALLOWANCE),
    socialSecurityDeduction: formatFixed2(socialSecurityDec),
    netTaxableIncome: formatFixed2(netTaxableDec),
    estimatedAnnualTax: formatFixed2(annualTaxDec),
    estimatedMonthlyTaxReserve: formatFixed2(monthlyReserveDec),
    marginalRatePct,
    headroomBeforeTaxable: formatFixed2(headroomDec),
    tier,
  };
}

/**
 * Formats a concise Thai toast notification after saving monthly salary / extra income in /plan.
 */
export function buildSalaryPlanTaxToast(
  summary: TaxEstimateSummary
): TaxToastAlert {
  if (summary.tier === "taxable") {
    return {
      kind: "warning",
      tier: "taxable",
      title: `เริ่มเข้าข่ายเสียภาษี ~฿${formatMoneyDisplay(summary.estimatedAnnualTax)}/ปี`,
      detail: `รายได้ทั้งปี ~฿${formatMoneyDisplay(summary.annualIncome)} (ขั้น ${summary.marginalRatePct}%) · แนะนำกันเงินสำรองเดือนละ ~฿${formatMoneyDisplay(summary.estimatedMonthlyTaxReserve)}`,
    };
  }

  if (summary.tier === "filing_required_zero_tax") {
    return {
      kind: "warning",
      tier: "filing_required_zero_tax",
      title: "เกณฑ์ภาษี: เสีย ฿0 (แต่ต้องยื่น ภ.ง.ด.91/90)",
      detail: `รายได้ทั้งปี ~฿${formatMoneyDisplay(summary.annualIncome)} · รับเพิ่มได้อีก ~฿${formatMoneyDisplay(summary.headroomBeforeTaxable)}/ปี ก่อนเริ่มเสียภาษี 5%`,
    };
  }

  return {
    kind: "success",
    tier: "below_filing",
    title: "เกณฑ์ภาษี: ยังไม่ถึงเกณฑ์เสียภาษี (฿0)",
    detail: `รายได้ตามแผนทั้งปี ~฿${formatMoneyDisplay(summary.annualIncome)} (ยังไม่เกิน ฿120,000/ปี)`,
  };
}

const TIER_RANK: Record<TaxTier, number> = {
  below_filing: 0,
  filing_required_zero_tax: 1,
  taxable: 2,
};

/**
 * Detects whether a newly recorded income transaction just crossed a Thai tax threshold
 * (either > 120,000/yr filing threshold or > 150,000 net taxable 5% bracket).
 * Returns null if the user stayed in the same tier (so daily recording stays silent).
 */
export function detectTaxThresholdCrossing(params: {
  prevAnnualIncome: string | number | Decimal;
  nextAnnualIncome: string | number | Decimal;
  monthlySalary?: string | number | Decimal;
  includeSocialSecurity?: boolean;
}): TaxToastAlert | null {
  const prev = estimateThaiPersonalIncomeTax({
    annualIncome: params.prevAnnualIncome,
    monthlySalary: params.monthlySalary,
    includeSocialSecurity: params.includeSocialSecurity,
  });
  const next = estimateThaiPersonalIncomeTax({
    annualIncome: params.nextAnnualIncome,
    monthlySalary: params.monthlySalary,
    includeSocialSecurity: params.includeSocialSecurity,
  });

  if (TIER_RANK[next.tier] <= TIER_RANK[prev.tier]) {
    return null;
  }

  if (next.tier === "taxable") {
    return {
      kind: "warning",
      tier: "taxable",
      title: "รายรับรวมปีนี้เข้าข่ายเริ่มเสียภาษีแล้ว",
      detail: `ยอดรวมทั้งปี ฿${formatMoneyDisplay(next.annualIncome)} · ประมาณการภาษี ~฿${formatMoneyDisplay(next.estimatedAnnualTax)}/ปี (กันไว้เดือนละ ~฿${formatMoneyDisplay(next.estimatedMonthlyTaxReserve)})`,
    };
  }

  return {
    kind: "warning",
    tier: "filing_required_zero_tax",
    title: "รายรับรวมปีนี้เกิน ฿120,000 แล้ว (เข้าเกณฑ์ยื่น ภ.ง.ด.)",
    detail: `ภาษีโดยประมาณยัง ฿0 · รับเพิ่มได้อีก ~฿${formatMoneyDisplay(next.headroomBeforeTaxable)}/ปี ก่อนเริ่มเสีย 5% (อย่าลืมยื่นแบบ ม.ค.–มี.ค. ปีถัดไป)`,
  };
}

/**
 * Safely extracts an optional TaxToastAlert from an unknown ActionResult payload.
 */
export function extractTaxAlertFromResult(data: unknown): TaxToastAlert | null {
  if (!data || typeof data !== "object" || !("taxAlert" in data)) {
    return null;
  }
  const candidate = (data as { taxAlert?: unknown }).taxAlert;
  if (
    candidate &&
    typeof candidate === "object" &&
    "title" in candidate &&
    "detail" in candidate &&
    "kind" in candidate
  ) {
    return candidate as TaxToastAlert;
  }
  return null;
}
