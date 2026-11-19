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
});
