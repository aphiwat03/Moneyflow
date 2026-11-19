import Decimal from "decimal.js";

export type WalletType =
  | "cash"
  | "bank"
  | "credit_card"
  | "ewallet"
  | "savings_goal"
  | "investment";

export type MoneyInput = string | number | Decimal | null | undefined;

export function toDecimal(value: MoneyInput): Decimal {
  if (value === null || value === undefined || value === "") {
    return new Decimal(0);
  }
  return value instanceof Decimal ? value : new Decimal(value);
}

export function formatFixed2(value: MoneyInput): string {
  const d = toDecimal(value);
  return d.isZero() ? "0.00" : d.toFixed(2);
}

/**
 * Formats an exact decimal string/value with thousands separators and 2 decimals.
 */
export function formatMoneyDisplay(value: MoneyInput): string {
  const fixed = formatFixed2(value);
  const isNegative = fixed.startsWith("-");
  const unsigned = isNegative ? fixed.slice(1) : fixed;
  const [intPart, decPart] = unsigned.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${isNegative ? "-" : ""}${withCommas}.${decPart}`;
}

export function sumMoney(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, val) => acc.plus(toDecimal(val)), new Decimal(0));
}

export function computeWalletBalance(input: {
  initialBalance: MoneyInput;
  incomeTotal: MoneyInput;
  expenseTotal: MoneyInput;
  transferInTotal: MoneyInput;
  transferOutTotal: MoneyInput;
}): Decimal {
  return toDecimal(input.initialBalance)
    .plus(toDecimal(input.incomeTotal))
    .minus(toDecimal(input.expenseTotal))
    .plus(toDecimal(input.transferInTotal))
    .minus(toDecimal(input.transferOutTotal));
}

export interface NetWorthSummary {
  cashAndBankTotal: string;
  creditCardDebtTotal: string;
  creditCardNetBalance: string;
  netWorth: string;
}

export function computeNetWorthSummary(
  wallets: Array<{ type: WalletType; balance: MoneyInput }>
): NetWorthSummary {
  let cashAndBank = new Decimal(0);
  let creditCardNet = new Decimal(0);

  for (const wallet of wallets) {
    const balance = toDecimal(wallet.balance);
    if (wallet.type === "credit_card") {
      creditCardNet = creditCardNet.plus(balance);
    } else {
      cashAndBank = cashAndBank.plus(balance);
    }
  }

  const creditCardDebt = creditCardNet.isNegative()
    ? creditCardNet.abs()
    : new Decimal(0);
  const netWorth = cashAndBank.plus(creditCardNet);

  return {
    cashAndBankTotal: formatFixed2(cashAndBank),
    creditCardDebtTotal: formatFixed2(creditCardDebt),
    creditCardNetBalance: formatFixed2(creditCardNet),
    netWorth: formatFixed2(netWorth),
  };
}

export function toChartNumber(value: MoneyInput): number {
  return toDecimal(value).toNumber();
}
