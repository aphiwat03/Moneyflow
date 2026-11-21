import Decimal from "decimal.js";
import { formatFixed2, toDecimal } from "./decimal";
import type { TransactionDTO } from "./types";

export type RecipientSortMode = "amount" | "count";

export interface RecipientSummaryGroup {
  key: string;
  recipientName: string;
  recipientBank: string | null;
  recipientAccount: string | null;
  totalAmount: string;
  transferCount: number;
  lastDate: string;
  shareOfMaxPct: number;
  transactions: TransactionDTO[];
}

/**
 * Ensures any bank account or PromptPay number stored in the system is masked
 * so full account numbers are never persisted in plaintext.
 */
export function maskAccountNumber(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  if (/[xX*]/.test(cleaned)) {
    return cleaned.replace(/[X*]/g, "x").slice(0, 64);
  }

  const digitPositions: number[] = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    if (cleaned[i] >= "0" && cleaned[i] <= "9") {
      digitPositions.push(i);
    }
  }

  if (digitPositions.length <= 4) {
    return cleaned.slice(0, 64);
  }

  const chars = cleaned.split("");
  const maskUntil = digitPositions.length - 4;
  for (let i = 0; i < maskUntil; i += 1) {
    chars[digitPositions[i]] = "x";
  }
  return chars.join("").slice(0, 64);
}

/**
 * Groups transactions with recipient metadata into a ranked leaderboard
 * sorted by total amount (default) or transfer count.
 */
export function buildRecipientLeaderboard(
  transactions: TransactionDTO[],
  sortBy: RecipientSortMode = "amount"
): RecipientSummaryGroup[] {
  const buckets = new Map<
    string,
    {
      key: string;
      recipientName: string;
      recipientBank: string | null;
      recipientAccount: string | null;
      totalDecimal: Decimal;
      lastDate: string;
      transactions: TransactionDTO[];
    }
  >();

  for (const tx of transactions) {
    const name = tx.recipientName?.trim() || "";
    const account = tx.recipientAccount?.trim() || "";
    const bank = tx.recipientBank?.trim() || null;

    if (!name && !account) {
      continue;
    }

    const key = name
      ? `name:${name.toLowerCase()}`
      : `acct:${account.toLowerCase()}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        recipientName: name || account,
        recipientBank: bank,
        recipientAccount: account || null,
        totalDecimal: new Decimal(0),
        lastDate: tx.transactionDate,
        transactions: [],
      };
      buckets.set(key, bucket);
    }

    if (!bucket.recipientBank && bank) {
      bucket.recipientBank = bank;
    }
    if (!bucket.recipientAccount && account) {
      bucket.recipientAccount = account;
    }
    if (tx.transactionDate > bucket.lastDate) {
      bucket.lastDate = tx.transactionDate;
    }

    bucket.totalDecimal = bucket.totalDecimal.plus(toDecimal(tx.amount));
    bucket.transactions.push(tx);
  }

  const list = Array.from(buckets.values());
  if (list.length === 0) return [];

  list.sort((a, b) => {
    if (sortBy === "count") {
      if (b.transactions.length !== a.transactions.length) {
        return b.transactions.length - a.transactions.length;
      }
      const amtDiff = b.totalDecimal.comparedTo(a.totalDecimal);
      if (amtDiff !== 0) return amtDiff;
      return b.lastDate.localeCompare(a.lastDate);
    }
    const amtDiff = b.totalDecimal.comparedTo(a.totalDecimal);
    if (amtDiff !== 0) return amtDiff;
    if (b.transactions.length !== a.transactions.length) {
      return b.transactions.length - a.transactions.length;
    }
    return b.lastDate.localeCompare(a.lastDate);
  });

  const maxAmount = list.reduce(
    (max, item) => (item.totalDecimal.gt(max) ? item.totalDecimal : max),
    new Decimal(0)
  );

  return list.map((item) => {
    const sortedTxs = [...item.transactions].sort((a, b) =>
      b.transactionDate.localeCompare(a.transactionDate)
    );
    const shareOfMaxPct = maxAmount.gt(0)
      ? Math.round(item.totalDecimal.div(maxAmount).mul(100).toNumber())
      : 0;

    return {
      key: item.key,
      recipientName: item.recipientName,
      recipientBank: item.recipientBank,
      recipientAccount: item.recipientAccount,
      totalAmount: formatFixed2(item.totalDecimal),
      transferCount: sortedTxs.length,
      lastDate: item.lastDate,
      shareOfMaxPct,
      transactions: sortedTxs,
    };
  });
}
