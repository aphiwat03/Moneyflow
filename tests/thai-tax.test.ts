import { describe, expect, it } from "vitest";
import {
  buildSalaryPlanTaxToast,
  detectTaxThresholdCrossing,
  estimateThaiPersonalIncomeTax,
} from "@/lib/thai-tax";

describe("thai-tax estimation & threshold crossing", () => {
  it("evaluates 14,500 THB/month salary as 0 THB tax with filing reminder", () => {
    // 14,500 * 12 = 174,000; expense = 87,000; personal = 60,000; SS = 14,500 * 5% * 12 = 8,700
    // net = 174,000 - 87,000 - 60,000 - 8,700 = 18,300 -> 0% tax
    const result = estimateThaiPersonalIncomeTax({
      annualIncome: 174_000,
      monthlySalary: 14_500,
    });

    expect(result.annualIncome).toBe("174000.00");
    expect(result.expenseDeduction).toBe("87000.00");
    expect(result.socialSecurityDeduction).toBe("8700.00");
    expect(result.netTaxableIncome).toBe("18300.00");
    expect(result.estimatedAnnualTax).toBe("0.00");
    expect(result.tier).toBe("filing_required_zero_tax");
    // Gross threshold = 150,000 + 100,000 + 60,000 + 8,700 = 318,700 -> headroom = 144,700
    expect(result.headroomBeforeTaxable).toBe("144700.00");

    const toast = buildSalaryPlanTaxToast(result);
    expect(toast.kind).toBe("warning");
    expect(toast.title).toContain("฿0");
    expect(toast.detail).toContain("144,700");
  });

  it("identifies below_filing tier when annual income is <= 120,000", () => {
    const result = estimateThaiPersonalIncomeTax({
      annualIncome: 120_000,
      monthlySalary: 10_000,
    });

    expect(result.tier).toBe("below_filing");
    expect(result.estimatedAnnualTax).toBe("0.00");
    expect(buildSalaryPlanTaxToast(result).kind).toBe("success");
  });

  it("computes progressive multi-bracket Thai PIT accurately (5% + 10%)", () => {
    // Annual 600,000; monthly 50,000 -> expense 100,000, personal 60,000, SS capped 9,000
    // net = 600,000 - 169,000 = 431,000
    // 0-150k: 0; 150k-300k: 150k * 5% = 7,500; 300k-431k: 131k * 10% = 13,100 -> total 20,600
    const result = estimateThaiPersonalIncomeTax({
      annualIncome: 600_000,
      monthlySalary: 50_000,
    });

    expect(result.socialSecurityDeduction).toBe("9000.00");
    expect(result.netTaxableIncome).toBe("431000.00");
    expect(result.estimatedAnnualTax).toBe("20600.00");
    expect(result.marginalRatePct).toBe(10);
    expect(result.tier).toBe("taxable");
    expect(result.headroomBeforeTaxable).toBe("0.00");
  });

  it("triggers crossing alert ONLY when crossing into a higher tax tier", () => {
    // Stay below 120k -> silent
    expect(
      detectTaxThresholdCrossing({
        prevAnnualIncome: 50_000,
        nextAnnualIncome: 65_000,
        monthlySalary: 14_500,
      })
    ).toBeNull();

    // Cross 120k filing threshold -> alert!
    const crossedFiling = detectTaxThresholdCrossing({
      prevAnnualIncome: 115_000,
      nextAnnualIncome: 130_000,
      monthlySalary: 14_500,
    });
    expect(crossedFiling).not.toBeNull();
    expect(crossedFiling?.tier).toBe("filing_required_zero_tax");

    // Stay inside filing_required_zero_tax -> silent (no spam on every payday)
    expect(
      detectTaxThresholdCrossing({
        prevAnnualIncome: 174_000,
        nextAnnualIncome: 200_000,
        monthlySalary: 14_500,
      })
    ).toBeNull();

    // Side income pushes annual total past 318,700 -> enters 5% tax bracket -> alert!
    const crossedTaxable = detectTaxThresholdCrossing({
      prevAnnualIncome: 310_000,
      nextAnnualIncome: 340_000,
      monthlySalary: 14_500,
    });
    expect(crossedTaxable).not.toBeNull();
    expect(crossedTaxable?.tier).toBe("taxable");
    expect(crossedTaxable?.kind).toBe("warning");

    // Already in taxable tier -> stays silent
    expect(
      detectTaxThresholdCrossing({
        prevAnnualIncome: 340_000,
        nextAnnualIncome: 355_000,
        monthlySalary: 14_500,
      })
    ).toBeNull();
  });
});
