"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Database,
  LayoutDashboard,
  PiggyBank,
  Plus,
  RotateCcw,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";
import Decimal from "decimal.js";
import type {
  SalaryAllocationFormInput,
  SalarySettingsFormInput,
} from "@/actions/salary-plan";
import type { TransactionFormInput } from "@/actions/transactions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildDashboardAnalytics,
  computeWalletsWithBalances,
} from "@/lib/dashboard-analytics";
import { getBangkokToday, getBangkokYearMonth } from "@/lib/date";
import { formatFixed2, sumMoney, toDecimal } from "@/lib/decimal";
import {
  createDemoTransactions,
  DEMO_INITIAL_CATEGORIES,
  DEMO_INITIAL_SALARY_ALLOCATIONS,
  DEMO_INITIAL_SALARY_SETTINGS,
  DEMO_INITIAL_WALLETS,
} from "@/lib/demo-data";
import {
  createBackupBundle,
  remapBackupBundleIds,
  type MoneyFlowBackupBundle,
} from "@/lib/portable-backup";
import { buildSalaryPlanSummary } from "@/lib/salary-plan";
import type {
  ActionResult,
  CategoryDTO,
  CategoryType,
  SalaryAllocationDTO,
  SalarySettingsDTO,
  TransactionDTO,
  TransactionFilterParams,
  WalletDTO,
  WalletType,
} from "@/lib/types";
import {
  buildSalaryPlanTaxToast,
  detectTaxThresholdCrossing,
  estimateThaiPersonalIncomeTax,
} from "@/lib/thai-tax";
import { cn } from "@/lib/utils";
import {
  categorySchema,
  salaryAllocationSchema,
  salarySettingsSchema,
  transactionSchema,
  walletSchema,
} from "@/lib/validations";
import { DashboardView } from "./dashboard-view";
import { InvestmentsView } from "./investments-view";
import { ManageView } from "./manage-view";
import { PlanView } from "./plan-view";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { TransactionsView } from "./transactions-view";

type DemoTab = "dashboard" | "transactions" | "plan" | "investments" | "manage";

const UI_WORKSPACE_STORAGE_KEY = "moneyflow_ui_workspace_v1";

interface PersistedUiWorkspace {
  rawWallets?: Array<Omit<WalletDTO, "currentBalance">>;
  categories?: CategoryDTO[];
  rawTransactions?: TransactionDTO[];
  salarySettings?: SalarySettingsDTO;
  salaryAllocations?: SalaryAllocationDTO[];
}

export function DemoWorkspace({
  initialYear,
  initialMonth,
  initialTransactions,
}: {
  initialYear: number;
  initialMonth: number;
  initialTransactions: TransactionDTO[];
}) {
  const [activeTab, setActiveTab] = useState<DemoTab>("dashboard");
  const [selectedYm, setSelectedYm] = useState({
    year: initialYear,
    month: initialMonth,
  });
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const [rawWallets, setRawWallets] = useState<
    Array<Omit<WalletDTO, "currentBalance">>
  >(() => DEMO_INITIAL_WALLETS);
  const [categories, setCategories] = useState<CategoryDTO[]>(
    () => DEMO_INITIAL_CATEGORIES
  );
  const [rawTransactions, setRawTransactions] = useState<TransactionDTO[]>(
    () => initialTransactions
  );
  const [salarySettings, setSalarySettings] = useState<SalarySettingsDTO>(
    () => DEMO_INITIAL_SALARY_SETTINGS
  );
  const [salaryAllocations, setSalaryAllocations] = useState<
    SalaryAllocationDTO[]
  >(() => DEMO_INITIAL_SALARY_ALLOCATIONS);
  const [demoResetVersion, setDemoResetVersion] = useState(0);
  const hasLoadedStorageRef = useRef(false);

  // Hydrate UI workspace state from browser localStorage after mount (zero SSR mismatch)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(UI_WORKSPACE_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedUiWorkspace;
        queueMicrotask(() => {
          if (Array.isArray(saved.rawWallets)) setRawWallets(saved.rawWallets);
          if (Array.isArray(saved.categories)) setCategories(saved.categories);
          if (Array.isArray(saved.rawTransactions)) {
            setRawTransactions(saved.rawTransactions);
          }
          if (saved.salarySettings) setSalarySettings(saved.salarySettings);
          if (Array.isArray(saved.salaryAllocations)) {
            setSalaryAllocations(saved.salaryAllocations);
          }
          setDemoResetVersion((v) => v + 1);
          hasLoadedStorageRef.current = true;
        });
        return;
      }
    } catch {
      // Ignore malformed localStorage payload
    }
    hasLoadedStorageRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasLoadedStorageRef.current) return;
    try {
      const payload: PersistedUiWorkspace = {
        rawWallets,
        categories,
        rawTransactions,
        salarySettings,
        salaryAllocations,
      };
      window.localStorage.setItem(
        UI_WORKSPACE_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch {
      // Ignore quota/storage errors in private browsing
    }
  }, [
    rawWallets,
    categories,
    rawTransactions,
    salarySettings,
    salaryAllocations,
  ]);

  // Recompute enriched transactions (latest wallet/category names) + live balances
  const transactions = useMemo<TransactionDTO[]>(() => {
    const walletMap = new Map(rawWallets.map((w) => [w.id, w]));
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return rawTransactions.map((tx) => {
      const w = walletMap.get(tx.walletId);
      const toW = tx.toWalletId ? walletMap.get(tx.toWalletId) : undefined;
      const c = tx.categoryId ? catMap.get(tx.categoryId) : undefined;
      return {
        ...tx,
        walletName: w?.name ?? tx.walletName,
        walletType: w?.type ?? tx.walletType,
        toWalletName: toW?.name ?? tx.toWalletName,
        categoryName: c?.name ?? tx.categoryName,
        categoryColor: c?.color ?? tx.categoryColor,
      };
    });
  }, [rawTransactions, rawWallets, categories]);

  const wallets = useMemo(
    () => computeWalletsWithBalances(rawWallets, transactions),
    [rawWallets, transactions]
  );

  const analytics = useMemo(
    () =>
      buildDashboardAnalytics({
        wallets,
        categories,
        transactions,
        selectedYear: selectedYm.year,
        selectedMonth: selectedYm.month,
      }),
    [wallets, categories, transactions, selectedYm]
  );

  const salaryPlan = useMemo(
    () =>
      buildSalaryPlanSummary({
        settings: salarySettings,
        allocations: salaryAllocations,
        wallets,
        transactions,
        selectedYear: selectedYm.year,
        selectedMonth: selectedYm.month,
      }),
    [salarySettings, salaryAllocations, wallets, transactions, selectedYm]
  );

  function handleResetDemo() {
    try {
      window.localStorage.removeItem(UI_WORKSPACE_STORAGE_KEY);
    } catch {
      // Ignore storage access errors
    }
    setRawWallets(DEMO_INITIAL_WALLETS);
    setCategories(DEMO_INITIAL_CATEGORIES);
    setRawTransactions(createDemoTransactions());
    setSalarySettings(DEMO_INITIAL_SALARY_SETTINGS);
    setSalaryAllocations(DEMO_INITIAL_SALARY_ALLOCATIONS);
    setSelectedYm(getBangkokYearMonth());
    setDemoResetVersion((v) => v + 1);
  }

  async function handleSaveTransaction(
    values: TransactionFormInput,
    editingId?: string
  ): Promise<ActionResult<unknown>> {
    const parsed = transactionSchema.safeParse(values);
    if (!parsed.success) {
      return {
        ok: false,
        error: "ข้อมูลรายการไม่ถูกต้อง",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const wallet = rawWallets.find((w) => w.id === parsed.data.walletId);
    if (!wallet) return { ok: false, error: "ไม่พบกระเป๋าเงินต้นทาง" };

    const toWallet = parsed.data.toWalletId
      ? rawWallets.find((w) => w.id === parsed.data.toWalletId)
      : undefined;
    const cat = parsed.data.categoryId
      ? categories.find((c) => c.id === parsed.data.categoryId)
      : undefined;

    if (parsed.data.type !== "transfer" && (!cat || cat.type !== parsed.data.type)) {
      return { ok: false, error: "กรุณาเลือกหมวดหมู่ที่ตรงกับประเภท" };
    }

    const existingTx = editingId
      ? rawTransactions.find((t) => t.id === editingId)
      : undefined;

    const nextTx: TransactionDTO = {
      id: editingId ?? crypto.randomUUID(),
      type: parsed.data.type,
      walletId: wallet.id,
      walletName: wallet.name,
      walletType: wallet.type,
      toWalletId: toWallet?.id ?? null,
      toWalletName: toWallet?.name ?? null,
      categoryId: cat?.id ?? null,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      amount: parsed.data.amount,
      transactionDate: parsed.data.transactionDate,
      transactionTime: parsed.data.transactionTime,
      createdAt: existingTx?.createdAt ?? new Date().toISOString(),
      note: parsed.data.note,
      recipientName: parsed.data.recipientName,
      recipientBank: parsed.data.recipientBank,
      recipientAccount: parsed.data.recipientAccount,
    };

    let taxAlert = null;
    if (!editingId && parsed.data.type === "income") {
      const txYear = parsed.data.transactionDate.slice(0, 4);
      const prevAnnualIncome = rawTransactions
        .filter(
          (t) => t.type === "income" && t.transactionDate.startsWith(`${txYear}-`)
        )
        .reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal("0"));
      const nextAnnualIncome = prevAnnualIncome.plus(
        toDecimal(parsed.data.amount)
      );
      taxAlert = detectTaxThresholdCrossing({
        prevAnnualIncome,
        nextAnnualIncome,
        monthlySalary: salarySettings.monthlySalary,
      });
    }

    setRawTransactions((prev) =>
      editingId
        ? prev.map((t) => (t.id === editingId ? nextTx : t))
        : [nextTx, ...prev]
    );
    return { ok: true, data: { id: nextTx.id, taxAlert } };
  }

  async function handleDeleteTransaction(
    transactionId: string
  ): Promise<ActionResult<unknown>> {
    setRawTransactions((prev) => prev.filter((t) => t.id !== transactionId));
    return { ok: true };
  }

  async function handleExportExcel(
    filters: TransactionFilterParams,
    filteredRows: TransactionDTO[]
  ) {
    const periodLabel =
      filters.startDate && filters.endDate
        ? `${filters.startDate} ถึง ${filters.endDate}`
        : "ข้อมูลตัวอย่าง (Demo)";

    const response = await fetch("/api/demo-export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodLabel,
        transactions: filteredRows.slice(0, 200),
      }),
    });

    if (!response.ok) {
      throw new Error("Export failed");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "MoneyFlow_Demo.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function handleCreateWallet(input: {
    name: string;
    type: WalletType;
    initialBalance: string;
    color?: string | null;
  }): Promise<ActionResult<unknown>> {
    const parsed = walletSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "ข้อมูลกระเป๋าเงินไม่ถูกต้อง",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    setRawWallets((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: parsed.data.name,
        type: parsed.data.type,
        initialBalance: parsed.data.initialBalance,
        color: parsed.data.color ?? "#0f766e",
        icon: "Wallet",
        isArchived: false,
      },
    ]);
    return { ok: true };
  }

  async function handleUpdateWallet(
    walletId: string,
    input: {
      name: string;
      type: WalletType;
      initialBalance: string;
      color?: string | null;
    }
  ): Promise<ActionResult<unknown>> {
    const parsed = walletSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "ข้อมูลกระเป๋าเงินไม่ถูกต้อง",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    setRawWallets((prev) =>
      prev.map((w) =>
        w.id === walletId
          ? {
              ...w,
              name: parsed.data.name,
              type: parsed.data.type,
              initialBalance: parsed.data.initialBalance,
              color: parsed.data.color ?? w.color,
            }
          : w
      )
    );
    return { ok: true };
  }

  async function handleToggleArchiveWallet(
    walletId: string,
    isArchived: boolean
  ): Promise<ActionResult<unknown>> {
    setRawWallets((prev) =>
      prev.map((w) => (w.id === walletId ? { ...w, isArchived } : w))
    );
    return { ok: true };
  }

  async function handleDeleteWallet(
    walletId: string
  ): Promise<ActionResult<unknown>> {
    const used = rawTransactions.some(
      (tx) => tx.walletId === walletId || tx.toWalletId === walletId
    );
    if (used) {
      return {
        ok: false,
        error:
          "ไม่สามารถลบกระเป๋านี้ได้เนื่องจากมีรายการผูกอยู่ กรุณาใช้การซ่อน (Archive) แทน",
      };
    }
    setRawWallets((prev) => prev.filter((w) => w.id !== walletId));
    return { ok: true };
  }

  async function handleAdjustWalletBalance(input: {
    walletId: string;
    actualBalance: string;
  }): Promise<ActionResult<unknown>> {
    const target = wallets.find((w) => w.id === input.walletId);
    if (!target) return { ok: false, error: "ไม่พบกระเป๋าเงิน" };
    try {
      const actualDec = toDecimal(input.actualBalance);
      const currentDec = toDecimal(target.currentBalance);
      const initialDec = toDecimal(target.initialBalance);
      const nextInitial = formatFixed2(
        initialDec.plus(actualDec.minus(currentDec))
      );
      setRawWallets((prev) =>
        prev.map((w) =>
          w.id === input.walletId ? { ...w, initialBalance: nextInitial } : w
        )
      );
      return { ok: true };
    } catch {
      return { ok: false, error: "ยอดเงินไม่ถูกต้อง" };
    }
  }

  async function handleCreateCategory(input: {
    name: string;
    type: CategoryType;
    monthlyBudget?: string | null;
    color?: string | null;
  }): Promise<ActionResult<unknown>> {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "ข้อมูลหมวดหมู่ไม่ถูกต้อง",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    setCategories((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: parsed.data.name,
        type: parsed.data.type,
        monthlyBudget: parsed.data.monthlyBudget,
        color: parsed.data.color ?? "#64748b",
        icon: "Tag",
        isDefault: false,
        isArchived: false,
      },
    ]);
    return { ok: true };
  }

  async function handleUpdateCategory(
    categoryId: string,
    input: {
      name: string;
      type: CategoryType;
      monthlyBudget?: string | null;
      color?: string | null;
    }
  ): Promise<ActionResult<unknown>> {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "ข้อมูลหมวดหมู่ไม่ถูกต้อง",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              name: parsed.data.name,
              monthlyBudget: parsed.data.monthlyBudget,
              color: parsed.data.color ?? c.color,
            }
          : c
      )
    );
    return { ok: true };
  }

  async function handleToggleArchiveCategory(
    categoryId: string,
    isArchived: boolean
  ): Promise<ActionResult<unknown>> {
    setCategories((prev) =>
      prev.map((c) => (c.id === categoryId ? { ...c, isArchived } : c))
    );
    return { ok: true };
  }

  async function handleDeleteCategory(
    categoryId: string
  ): Promise<ActionResult<unknown>> {
    const used = rawTransactions.some((tx) => tx.categoryId === categoryId);
    if (used) {
      return {
        ok: false,
        error:
          "ไม่สามารถลบหมวดหมู่นี้ได้เนื่องจากมีรายการผูกอยู่ กรุณาใช้การซ่อน (Archive) แทน",
      };
    }
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    return { ok: true };
  }

  async function handleImportDemoTransactions(
    rows: TransactionFormInput[]
  ): Promise<ActionResult<{ importedCount: number }>> {
    for (const r of rows) {
      await handleSaveTransaction(r);
    }
    return { ok: true, data: { importedCount: rows.length } };
  }

  async function handleSaveDemoSalarySettings(
    input: SalarySettingsFormInput
  ): Promise<ActionResult<unknown>> {
    const parsed = salarySettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "ข้อมูลการตั้งค่าเงินเดือนไม่ถูกต้อง",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    setSalarySettings({
      monthlySalary: parsed.data.monthlySalary,
      extraIncome: parsed.data.extraIncome,
      payday: parsed.data.payday,
      salaryWalletId: parsed.data.salaryWalletId,
    });
    const annualProjected = toDecimal(parsed.data.monthlySalary)
      .plus(toDecimal(parsed.data.extraIncome))
      .times(12);
    const taxAlert = annualProjected.gt(0)
      ? buildSalaryPlanTaxToast(
          estimateThaiPersonalIncomeTax({
            annualIncome: annualProjected,
            monthlySalary: parsed.data.monthlySalary,
          })
        )
      : undefined;
    return { ok: true, data: { taxAlert } };
  }

  async function handleSaveDemoSalaryAllocation(
    input: SalaryAllocationFormInput,
    editingId?: string
  ): Promise<ActionResult<unknown>> {
    const parsed = salaryAllocationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "ข้อมูลเป้าหมายการออมไม่ถูกต้อง",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }
    if (editingId) {
      setSalaryAllocations((prev) =>
        prev.map((a) =>
          a.id === editingId
            ? {
                ...a,
                name: parsed.data.name,
                bucketType: parsed.data.bucketType,
                mode: parsed.data.mode,
                value: parsed.data.value,
                targetTotal: parsed.data.targetTotal,
                targetMonths: parsed.data.targetMonths,
                linkedWalletId: parsed.data.linkedWalletId,
                isActive: parsed.data.isActive,
              }
            : a
        )
      );
    } else {
      setSalaryAllocations((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: parsed.data.name,
          bucketType: parsed.data.bucketType,
          mode: parsed.data.mode,
          value: parsed.data.value,
          targetTotal: parsed.data.targetTotal,
          targetMonths: parsed.data.targetMonths,
          linkedWalletId: parsed.data.linkedWalletId,
          sortOrder: prev.length,
          isActive: parsed.data.isActive,
        },
      ]);
    }
    return { ok: true };
  }

  async function handleDeleteDemoSalaryAllocation(
    allocationId: string
  ): Promise<ActionResult<unknown>> {
    setSalaryAllocations((prev) => prev.filter((a) => a.id !== allocationId));
    return { ok: true };
  }

  async function handleApplyDemoRecommendedSplit(params: {
    strategyId: "balanced" | "conservative" | "aggressive_invest";
    replaceExisting?: boolean;
  }): Promise<ActionResult<unknown>> {
    const presets = {
      balanced: [
        { name: "เงินเย็น (สำรองฉุกเฉิน)", bucketType: "cold_money" as const, value: "10.00" },
        { name: "ลงทุน DCA รายเดือน", bucketType: "dca" as const, value: "10.00" },
        { name: "ของที่อยากได้ (Wishlist)", bucketType: "wishlist" as const, value: "5.00" },
      ],
      conservative: [
        { name: "เงินเย็น (สำรองฉุกเฉิน)", bucketType: "cold_money" as const, value: "15.00" },
        { name: "ลงทุน DCA รายเดือน", bucketType: "dca" as const, value: "10.00" },
        { name: "ของที่อยากได้ (Wishlist)", bucketType: "wishlist" as const, value: "5.00" },
      ],
      aggressive_invest: [
        { name: "เงินเย็น (สำรองฉุกเฉิน)", bucketType: "cold_money" as const, value: "15.00" },
        { name: "ลงทุน DCA รายเดือน", bucketType: "dca" as const, value: "20.00" },
        { name: "ของที่อยากได้ (Wishlist)", bucketType: "wishlist" as const, value: "5.00" },
      ],
    };
    const nextItems: SalaryAllocationDTO[] = presets[params.strategyId].map(
      (p, idx) => ({
        id: crypto.randomUUID(),
        name: p.name,
        bucketType: p.bucketType,
        mode: "percent",
        value: p.value,
        targetTotal: null,
        targetMonths: null,
        linkedWalletId: null,
        sortOrder: idx,
        isActive: true,
      })
    );
    setSalaryAllocations((prev) =>
      params.replaceExisting ? nextItems : [...prev, ...nextItems]
    );
    return { ok: true };
  }

  async function handleExecuteDemoMonthlyTransfers(params: {
    year: number;
    month: number;
  }): Promise<ActionResult<{ createdCount: number; totalTransferred: string }>> {
    if (!salarySettings.salaryWalletId) {
      return { ok: false, error: "กรุณาเลือกกระเป๋ารับเงินเดือนก่อน" };
    }
    const source = rawWallets.find((w) => w.id === salarySettings.salaryWalletId);
    if (!source) {
      return { ok: false, error: "ไม่พบกระเป๋ารับเงินเดือน" };
    }
    const bangkokNow = getBangkokYearMonth();
    const transferDate =
      params.year === bangkokNow.year && params.month === bangkokNow.month
        ? getBangkokToday()
        : `${params.year}-${String(params.month).padStart(2, "0")}-01`;

    const pending = salaryPlan.allocations.filter(
      (a) =>
        a.isActive &&
        a.linkedWalletId &&
        a.linkedWalletId !== source.id &&
        new Decimal(a.pendingTransfer).gt(0)
    );
    if (pending.length === 0) {
      return { ok: false, error: "ไม่มีรายการที่ต้องโอนในเดือนนี้" };
    }

    let total = new Decimal(0);
    const createdTxs: TransactionDTO[] = [];
    for (const item of pending) {
      const dest = rawWallets.find((w) => w.id === item.linkedWalletId);
      if (!dest) continue;
      total = total.plus(item.pendingTransfer);
      createdTxs.push({
        id: crypto.randomUUID(),
        type: "transfer",
        walletId: source.id,
        walletName: source.name,
        walletType: source.type,
        toWalletId: dest.id,
        toWalletName: dest.name,
        categoryId: null,
        categoryName: null,
        categoryColor: null,
        amount: item.pendingTransfer,
        transactionDate: transferDate,
        note: `โอนตามแผน: ${item.name}`,
      });
    }

    setRawTransactions((prev) => [...createdTxs, ...prev]);
    return {
      ok: true,
      data: {
        createdCount: createdTxs.length,
        totalTransferred: total.toFixed(2),
      },
    };
  }

  async function handleExportDemoFullBackup(): Promise<
    ActionResult<MoneyFlowBackupBundle>
  > {
    try {
      const bundle = createBackupBundle({
        wallets: rawWallets,
        categories,
        salarySettings,
        salaryAllocations,
        transactions: rawTransactions,
      });
      return { ok: true, data: bundle };
    } catch {
      return { ok: false, error: "ไม่สามารถสร้างไฟล์สำรองข้อมูลได้" };
    }
  }

  async function handleRestoreDemoFullBackup(
    inputBundle: MoneyFlowBackupBundle
  ): Promise<
    ActionResult<{
      walletsCount: number;
      categoriesCount: number;
      transactionsCount: number;
      allocationsCount: number;
    }>
  > {
    try {
      const bundle = remapBackupBundleIds(inputBundle);
      const walletMap = new Map(bundle.wallets.map((w) => [w.id, w]));
      const catMap = new Map(bundle.categories.map((c) => [c.id, c]));

      const restoredTransactions: TransactionDTO[] = bundle.transactions.map(
        (t) => {
          const w = walletMap.get(t.walletId);
          const toW = t.toWalletId ? walletMap.get(t.toWalletId) : undefined;
          const c = t.categoryId ? catMap.get(t.categoryId) : undefined;
          return {
            id: t.id,
            type: t.type,
            walletId: t.walletId,
            walletName: w?.name ?? "ไม่ระบุ",
            walletType: w?.type ?? "bank",
            toWalletId: t.toWalletId,
            toWalletName: toW?.name ?? null,
            categoryId: t.categoryId,
            categoryName: c?.name ?? null,
            categoryColor: c?.color ?? null,
            amount: t.amount,
            transactionDate: t.transactionDate,
            note: t.note,
            recipientName: t.recipientName ?? null,
            recipientBank: t.recipientBank ?? null,
            recipientAccount: t.recipientAccount ?? null,
          };
        }
      );

      setRawWallets(bundle.wallets);
      setCategories(bundle.categories);
      setSalarySettings(
        bundle.salarySettings ?? {
          monthlySalary: "0.00",
          payday: 1,
          salaryWalletId: null,
        }
      );
      setSalaryAllocations(bundle.salaryAllocations);
      setRawTransactions(restoredTransactions);
      setDemoResetVersion((v) => v + 1);

      return {
        ok: true,
        data: {
          walletsCount: bundle.wallets.length,
          categoriesCount: bundle.categories.length,
          transactionsCount: bundle.transactions.length,
          allocationsCount: bundle.salaryAllocations.length,
        },
      };
    } catch {
      return { ok: false, error: "ไม่สามารถกู้คืนข้อมูลจากไฟล์สำรองได้" };
    }
  }

  const navItems: Array<{
    id: DemoTab;
    label: string;
    icon: typeof LayoutDashboard;
  }> = [
    { id: "dashboard", label: "ภาพรวม", icon: LayoutDashboard },
    { id: "transactions", label: "รายการ", icon: ArrowLeftRight },
    { id: "plan", label: "แผนเงินเดือน", icon: PiggyBank },
    { id: "investments", label: "การลงทุน", icon: TrendingUp },
    { id: "manage", label: "กระเป๋า & หมวดหมู่", icon: WalletCards },
  ];

  const demoInvestmentWallets = wallets.filter(
    (w) => !w.isArchived && w.type === "investment"
  );
  const demoInvestmentWalletTotal = formatFixed2(
    sumMoney(demoInvestmentWallets.map((w) => w.currentBalance))
  );
  const demoCurrentMonthKey = `${initialYear}-${String(initialMonth).padStart(2, "0")}`;

  return (
    <div className="flex min-h-dvh w-full bg-muted/20">
      {/* Desktop / iPad Landscape Sidebar */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:bg-card">
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-semibold leading-none">MoneyFlow</p>
            <p className="mt-1 text-xs text-muted-foreground">UI Preview Mode</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-teal-700/10 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-2 border-t p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetDemo}
            className="w-full gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>รีเซ็ตข้อมูลตัวอย่าง</span>
          </Button>
          <Link href="/login" className="block">
            <Button size="sm" className="w-full">
              ไปหน้าเข้าสู่ระบบจริง
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Demo Notice Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-teal-700/10 px-4 py-2 text-xs text-teal-900 dark:bg-teal-500/10 dark:text-teal-200 md:px-8">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>โหมดทดลอง UI (ข้อมูลตัวอย่าง):</strong>{" "}
              ทดลองจดรายการ ดูกราฟ จัดการกระเป๋า และ Export .xlsx ได้ทันที
              (ข้อมูลนี้ยังไม่บันทึกลง PostgreSQL)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="lg:hidden">
              Demo
            </Badge>
            <Link
              href="/login"
              className="font-medium underline underline-offset-4"
            >
              เข้าสู่ระบบจริง
            </Link>
          </div>
        </div>

        {/* Mobile & iPad Portrait Header */}
        <header className="sticky top-0 z-30 border-b bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
                <Wallet className="h-4 w-4" />
              </div>
              <span className="font-semibold">MoneyFlow</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDemo}
              className="gap-1 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>รีเซ็ต</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:px-6 lg:px-8 lg:py-8 lg:pb-8">
          <div key={activeTab} className="animate-mf-fade-up">
            {activeTab === "dashboard" ? (
              <DashboardView
                userName="โหมดทดลองใช้งาน"
                analytics={analytics}
                salaryPlan={salaryPlan}
                wallets={wallets}
                categories={categories}
                onChangeMonth={(year, month) => setSelectedYm({ year, month })}
                onSaveTransaction={handleSaveTransaction}
                onViewAllTransactions={() => setActiveTab("transactions")}
                onOpenPlan={() => setActiveTab("plan")}
                onOpenManage={() => setActiveTab("manage")}
              />
            ) : activeTab === "transactions" ? (
              <TransactionsView
                transactions={transactions}
                wallets={wallets}
                categories={categories}
                onSaveTransaction={handleSaveTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onExportExcel={handleExportExcel}
                onImportTransactions={handleImportDemoTransactions}
              />
            ) : activeTab === "plan" ? (
              <PlanView
                key={`demo-plan-${demoResetVersion}`}
                summary={salaryPlan}
                wallets={wallets}
                onChangeMonth={(year, month) => setSelectedYm({ year, month })}
                onSaveSettings={handleSaveDemoSalarySettings}
                onSaveAllocation={handleSaveDemoSalaryAllocation}
                onDeleteAllocation={handleDeleteDemoSalaryAllocation}
                onApplyRecommendedSplit={handleApplyDemoRecommendedSplit}
                onExecuteMonthlyTransfers={handleExecuteDemoMonthlyTransfers}
              />
            ) : activeTab === "investments" ? (
              <InvestmentsView
                key={`demo-investments-${demoResetVersion}`}
                storageKey="moneyflow_demo_investments_ui_v1"
                currentGregorianYear={initialYear}
                currentMonthKey={demoCurrentMonthKey}
                linkedInvestmentWalletTotal={demoInvestmentWalletTotal}
                linkedInvestmentWalletCount={demoInvestmentWallets.length}
                linkedPlanDcaMonthly={salaryPlan.bucketTotals.dca}
              />
            ) : (
              <ManageView
                key={`demo-manage-${demoResetVersion}`}
                wallets={wallets}
                categories={categories}
                salarySettings={salarySettings}
                onSaveSalarySettings={handleSaveDemoSalarySettings}
                onCreateWallet={handleCreateWallet}
                onUpdateWallet={handleUpdateWallet}
                onToggleArchiveWallet={handleToggleArchiveWallet}
                onDeleteWallet={handleDeleteWallet}
                onAdjustWalletBalance={handleAdjustWalletBalance}
                onCreateCategory={handleCreateCategory}
                onUpdateCategory={handleUpdateCategory}
                onToggleArchiveCategory={handleToggleArchiveCategory}
                onDeleteCategory={handleDeleteCategory}
                onExportFullBackup={handleExportDemoFullBackup}
                onRestoreFullBackup={handleRestoreDemoFullBackup}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile & iPad Portrait Bottom Navigation */}
      <nav
        aria-label="เมนูมือถือ"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pr-[max(0.25rem,env(safe-area-inset-right))] pb-[env(safe-area-inset-bottom)] pl-[max(0.25rem,env(safe-area-inset-left))] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid h-16 max-w-xl grid-cols-6 items-center">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium whitespace-nowrap sm:text-[11px]",
              activeTab === "dashboard"
                ? "text-teal-700 dark:text-teal-400"
                : "text-muted-foreground"
            )}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>ภาพรวม</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium whitespace-nowrap sm:text-[11px]",
              activeTab === "transactions"
                ? "text-teal-700 dark:text-teal-400"
                : "text-muted-foreground"
            )}
          >
            <ArrowLeftRight className="h-5 w-5" />
            <span>รายการ</span>
          </button>

          <button
            type="button"
            aria-label="บันทึกรายการใหม่"
            onClick={() => setQuickAddOpen(true)}
            className="flex flex-col items-center justify-center"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-white shadow-md sm:h-11 sm:w-11">
              <Plus className="h-5 w-5" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("plan")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium whitespace-nowrap sm:text-[11px]",
              activeTab === "plan"
                ? "text-teal-700 dark:text-teal-400"
                : "text-muted-foreground"
            )}
          >
            <PiggyBank className="h-5 w-5" />
            <span>แผนเงิน</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("investments")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium whitespace-nowrap sm:text-[11px]",
              activeTab === "investments"
                ? "text-teal-700 dark:text-teal-400"
                : "text-muted-foreground"
            )}
          >
            <TrendingUp className="h-5 w-5" />
            <span>ลงทุน</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("manage")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium whitespace-nowrap sm:text-[11px]",
              activeTab === "manage"
                ? "text-teal-700 dark:text-teal-400"
                : "text-muted-foreground"
            )}
          >
            <WalletCards className="h-5 w-5" />
            <span>จัดการ</span>
          </button>
        </div>
      </nav>

      <TransactionFormDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        wallets={wallets}
        categories={categories}
        demoMode
        onSubmit={handleSaveTransaction}
      />
    </div>
  );
}
