export type WalletType =
  | "cash"
  | "bank"
  | "credit_card"
  | "ewallet"
  | "savings_goal"
  | "investment";
export type CategoryType = "income" | "expense";
export type TransactionType = "income" | "expense" | "transfer";
export type PlanBucketType = "cold_money" | "dca" | "wishlist" | "other";
export type PlanAllocationMode = "fixed" | "percent";

export interface WalletDTO {
  id: string;
  name: string;
  type: WalletType;
  initialBalance: string;
  currentBalance: string;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
}

export interface CategoryDTO {
  id: string;
  name: string;
  type: CategoryType;
  monthlyBudget: string | null;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  isArchived: boolean;
}

export interface BudgetStatusPoint {
  categoryId: string;
  name: string;
  color: string;
  budget: string;
  spent: string;
  remaining: string;
  percentage: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
}

export interface TransactionDTO {
  id: string;
  type: TransactionType;
  walletId: string;
  walletName: string;
  walletType: WalletType;
  toWalletId: string | null;
  toWalletName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  amount: string;
  transactionDate: string;
  note: string | null;
}

export interface TransactionFilterParams {
  q?: string;
  type?: TransactionType | "all";
  walletId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

export interface MonthlyChartPoint {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
}

export interface CategoryBreakdownPoint {
  categoryId: string;
  name: string;
  color: string;
  amount: string;
  chartValue: number;
  percentage: number;
}

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  totalRecordedDays: number;
  recordedToday: boolean;
  atRisk: boolean;
  lastRecordedDate: string | null;
}

export interface DashboardAnalytics {
  selectedYear: number;
  selectedMonth: number;
  startDate: string;
  endDate: string;
  periodIncome: string;
  periodExpense: string;
  periodNet: string;
  periodTransfer: string;
  cashAndBankTotal: string;
  creditCardDebtTotal: string;
  creditCardNetBalance: string;
  netWorth: string;
  expenseByCategory: CategoryBreakdownPoint[];
  budgetStatuses: BudgetStatusPoint[];
  monthlyTrend: MonthlyChartPoint[];
  recentTransactions: TransactionDTO[];
  streak: StreakSummary;
}

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export interface SalarySettingsDTO {
  monthlySalary: string;
  extraIncome?: string;
  payday: number;
  salaryWalletId: string | null;
}

export interface SalaryAllocationDTO {
  id: string;
  name: string;
  bucketType: PlanBucketType;
  mode: PlanAllocationMode;
  value: string;
  targetTotal: string | null;
  targetMonths: number | null;
  linkedWalletId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ComputedAllocationItem extends SalaryAllocationDTO {
  monthlyAmount: string;
  percentOfSalary: number;
  linkedWalletName: string | null;
  linkedWalletBalance: string | null;
  transferredThisMonth: string;
  pendingTransfer: string;
  isCompletedThisMonth: boolean;
}

export interface SalaryPlanSummary {
  hasSalaryConfigured: boolean;
  monthlySalary: string;
  extraIncome: string;
  totalPlannedIncome: string;
  payday: number;
  salaryWalletId: string | null;
  salaryWalletName: string | null;
  selectedYear: number;
  selectedMonth: number;
  cycleStartDate: string;
  cycleEndDate: string;
  totalAllocated: string;
  allocationRatioPct: number;
  isOverAllocated: boolean;
  spendableBudget: string;
  periodIncome: string;
  periodExpense: string;
  remainingToSpend: string;
  todayDate: string;
  todayExpense: string;
  todayIncome: string;
  todayBudget: string;
  todayRemaining: string;
  daysInMonth: number;
  daysRemaining: number;
  dailyAllowance: string;
  bucketTotals: {
    cold_money: string;
    dca: string;
    wishlist: string;
    other: string;
  };
  allocations: ComputedAllocationItem[];
  pendingTransferTotal: string;
  pendingTransferCount: number;
}

export type InvestmentAssetType =
  | "etf"
  | "stock"
  | "mutual_fund"
  | "gold_bond"
  | "other";

export interface InvestmentPlanSettingsDTO {
  targetGoalAmount: string;
  startingPrincipal: string;
  monthlyDca: string;
  expectedAnnualReturnPct: number;
  horizonYears: number;
  annualDcaStepUpPct: number;
  reinvestDividends: boolean;
}

export interface InvestmentHoldingDTO {
  id: string;
  symbol: string;
  name: string;
  assetType: InvestmentAssetType;
  targetAllocationPct: number;
  expectedAnnualReturnPct: number;
  investedCost: string;
  currentValue: string;
  dividendsReceived: string;
  broker: string | null;
  note: string | null;
  color: string;
}

export interface InvestmentSnapshotDTO {
  id: string;
  monthKey: string; // YYYY-MM
  investedCost: string;
  marketValue: string;
  dividends: string;
  note: string | null;
}

export interface InvestmentProjectionPoint {
  yearIndex: number;
  buddhistYear: number;
  label: string;
  contributed: number;
  projectedValue: number;
  compoundGain: number;
  targetGoal: number;
}

export interface InvestmentProjectionSummary {
  points: InvestmentProjectionPoint[];
  finalValue: string;
  finalContributed: string;
  finalGain: string;
  finalGainPct: number;
  goalProgressPct: number;
  monthsToGoal: number | null; // null if unreachable within 50 years
  targetBuddhistYear: number | null;
  requiredMonthlyDcaForHorizon: string;
}

export interface ComputedInvestmentHolding extends InvestmentHoldingDTO {
  monthlyDcaAmount: string;
  unrealizedGain: string;
  unrealizedGainPct: number;
  totalReturnWithDividends: string;
  totalReturnPct: number;
  actualWeightPct: number;
}

export interface InvestmentPortfolioSummary {
  holdings: ComputedInvestmentHolding[];
  totalTargetAllocationPct: number;
  weightedExpectedReturnPct: number;
  totalInvestedCost: string;
  totalCurrentValue: string;
  totalDividends: string;
  totalUnrealizedGain: string;
  totalUnrealizedGainPct: number;
  totalReturnWithDividends: string;
  totalReturnWithDividendsPct: number;
  hasRealTrackingData: boolean;
}
