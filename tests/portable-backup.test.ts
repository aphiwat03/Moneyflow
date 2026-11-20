import { describe, expect, it } from "vitest";
import {
  createDemoTransactions,
  DEMO_INITIAL_CATEGORIES,
  DEMO_INITIAL_SALARY_ALLOCATIONS,
  DEMO_INITIAL_SALARY_SETTINGS,
  DEMO_INITIAL_WALLETS,
} from "@/lib/demo-data";
import {
  createBackupBundle,
  parseBackupBundle,
  remapBackupBundleIds,
} from "@/lib/portable-backup";

describe("portable backup & PC migration engine", () => {
  it("creates, parses, and validates a full MoneyFlow backup bundle", () => {
    const demoTxs = createDemoTransactions();
    const bundle = createBackupBundle({
      wallets: DEMO_INITIAL_WALLETS,
      categories: DEMO_INITIAL_CATEGORIES,
      salarySettings: DEMO_INITIAL_SALARY_SETTINGS,
      salaryAllocations: DEMO_INITIAL_SALARY_ALLOCATIONS,
      transactions: demoTxs,
      exportedAt: "2026-11-18T12:00:00.000Z",
    });

    const json = JSON.stringify(bundle);
    const parsed = parseBackupBundle(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.wallets).toHaveLength(DEMO_INITIAL_WALLETS.length);
      expect(parsed.data.categories).toHaveLength(DEMO_INITIAL_CATEGORIES.length);
      expect(parsed.data.salaryAllocations).toHaveLength(
        DEMO_INITIAL_SALARY_ALLOCATIONS.length
      );
      expect(parsed.data.transactions).toHaveLength(demoTxs.length);
      expect(parsed.data.salarySettings?.payday).toBe(1);
    }
  });

  it("rejects backup bundles with broken foreign key references", () => {
    const demoTxs = createDemoTransactions();
    const bundle = createBackupBundle({
      wallets: DEMO_INITIAL_WALLETS,
      categories: DEMO_INITIAL_CATEGORIES,
      salarySettings: DEMO_INITIAL_SALARY_SETTINGS,
      salaryAllocations: DEMO_INITIAL_SALARY_ALLOCATIONS,
      transactions: demoTxs,
    });

    const broken = {
      ...bundle,
      transactions: [
        {
          ...bundle.transactions[0],
          walletId: "99999999-9999-4999-8999-999999999999",
        },
      ],
    };

    const parsed = parseBackupBundle(broken);
    expect(parsed.ok).toBe(false);
  });

  it("remaps all IDs to fresh UUIDs while preserving all relational links", () => {
    const demoTxs = createDemoTransactions();
    const original = createBackupBundle({
      wallets: DEMO_INITIAL_WALLETS,
      categories: DEMO_INITIAL_CATEGORIES,
      salarySettings: DEMO_INITIAL_SALARY_SETTINGS,
      salaryAllocations: DEMO_INITIAL_SALARY_ALLOCATIONS,
      transactions: demoTxs,
    });

    const remapped = remapBackupBundleIds(original);

    // Every entity gets a brand new UUID
    const originalWalletIds = new Set(original.wallets.map((w) => w.id));
    for (const w of remapped.wallets) {
      expect(originalWalletIds.has(w.id)).toBe(false);
    }

    // Remapped bundle still passes strict referential integrity validation
    const revalidated = parseBackupBundle(remapped);
    expect(revalidated.ok).toBe(true);

    // Salary wallet link & allocation links still match remapped wallet names
    const remappedSalaryWallet = remapped.wallets.find(
      (w) => w.id === remapped.salarySettings?.salaryWalletId
    );
    expect(remappedSalaryWallet?.name).toBe("KBank ออมทรัพย์");

    const coldAlloc = remapped.salaryAllocations.find((a) =>
      a.name.includes("เงินเย็น")
    );
    const coldWallet = remapped.wallets.find(
      (w) => w.id === coldAlloc?.linkedWalletId
    );
    expect(coldWallet?.name).toBe("บัญชีเงินเย็น");
  });

  it("round-trips and remaps investment holdings, snapshots, and linked DCA logs cleanly", () => {
    const demoTxs = createDemoTransactions();
    const linkedTxId = demoTxs[0].id;
    const bundle = createBackupBundle({
      wallets: DEMO_INITIAL_WALLETS,
      categories: DEMO_INITIAL_CATEGORIES,
      salarySettings: DEMO_INITIAL_SALARY_SETTINGS,
      salaryAllocations: DEMO_INITIAL_SALARY_ALLOCATIONS,
      transactions: demoTxs,
      investments: {
        settings: {
          targetGoalAmount: "3000000.00",
          startingPrincipal: "50000.00",
          monthlyDca: "5000.00",
          expectedAnnualReturnPct: 8.5,
          horizonYears: 15,
          annualDcaStepUpPct: 5,
          reinvestDividends: true,
        },
        holdings: [
          {
            id: "holding-voo-1",
            symbol: "VOO",
            name: "Vanguard S&P 500 ETF",
            assetType: "etf",
            targetAllocationPct: 100,
            expectedAnnualReturnPct: 9,
            investedCost: "15000.00",
            currentValue: "16200.00",
            dividendsReceived: "180.00",
            units: "0.850000",
            currency: "USD",
            broker: "Dime",
            note: "ซื้อทุกวันที่ 25",
            color: "#0f766e",
            sortOrder: 0,
          },
        ],
        snapshots: [
          {
            id: "snap-1",
            monthKey: "2026-11",
            investedCost: "15000.00",
            marketValue: "16200.00",
            dividends: "180.00",
            note: "อัปเดตสิ้นเดือน",
          },
        ],
        dcaLogs: [
          {
            id: "dca-log-1",
            holdingId: "holding-voo-1",
            transactionId: linkedTxId,
            executedDate: "2026-11-19",
            amountThb: "5000.00",
            unitsBought: "0.280000",
            pricePerUnit: "525.5000",
            feeThb: "0.00",
            note: "รอบ พ.ย.",
          },
        ],
      },
    });

    const remapped = remapBackupBundleIds(bundle);
    const parsed = parseBackupBundle(JSON.stringify(remapped));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.investments?.holdings).toHaveLength(1);
      expect(parsed.data.investments?.snapshots).toHaveLength(1);
      expect(parsed.data.investments?.dcaLogs).toHaveLength(1);
      const remappedHoldingId = parsed.data.investments!.holdings[0].id;
      const remappedLog = parsed.data.investments!.dcaLogs[0];
      expect(remappedHoldingId).not.toBe("holding-voo-1");
      expect(remappedLog.holdingId).toBe(remappedHoldingId);
      expect(
        parsed.data.transactions.some((tx) => tx.id === remappedLog.transactionId)
      ).toBe(true);
    }

    // Rejects broken DCA holding reference
    const broken = {
      ...bundle,
      investments: {
        ...bundle.investments!,
        dcaLogs: [
          {
            ...bundle.investments!.dcaLogs[0],
            holdingId: "non-existent-holding",
          },
        ],
      },
    };
    expect(parseBackupBundle(broken).ok).toBe(false);
  });
});
