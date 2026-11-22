"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  Coins,
  Download,
  Plus,
  RotateCcw,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type {
  InvestmentHoldingFormInput,
  InvestmentSnapshotFormInput,
  RecordDcaExecutionInput,
  RecordDividendInput,
} from "@/actions/investments";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { getBangkokToday } from "@/lib/date";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import {
  applyDcaPurchaseMath,
  buildInvestmentProjection,
  buildMonthlyDcaChecklist,
  computeInvestmentPortfolioSummary,
  DEFAULT_INVESTMENT_HOLDINGS,
  DEFAULT_INVESTMENT_SETTINGS,
  formatMonthsToYearsThai,
  reverseDcaPurchaseMath,
  type InvestmentHoldingPreset,
} from "@/lib/investment-calc";
import type {
  ActionResult,
  CategoryDTO,
  InvestmentCurrency,
  InvestmentDcaLogDTO,
  InvestmentHoldingDTO,
  InvestmentPlanSettingsDTO,
  InvestmentSnapshotDTO,
  WalletDTO,
} from "@/lib/types";
import {
  formatMonthKeyThai,
  HOLDING_COLOR_PRESETS,
  InvestmentDcaDialog,
  InvestmentDividendDialog,
  InvestmentHoldingDialog,
  InvestmentSnapshotDialog,
  parseSafeNonNegative,
} from "./investments/investment-dialogs";
import { InvestmentHoldingsSection } from "./investments/investment-holdings-section";
import { InvestmentSimulatorCard } from "./investments/investment-simulator-card";

interface PersistedInvestmentWorkspace {
  settings?: InvestmentPlanSettingsDTO;
  holdings?: InvestmentHoldingDTO[];
  snapshots?: InvestmentSnapshotDTO[];
  dcaLogs?: InvestmentDcaLogDTO[];
}

export interface InvestmentsViewDbHandlers {
  onSaveSettings: (
    settings: InvestmentPlanSettingsDTO,
  ) => Promise<ActionResult>;
  onUpsertHolding: (
    input: InvestmentHoldingFormInput,
    editingId?: string,
  ) => Promise<ActionResult<InvestmentHoldingDTO>>;
  onDeleteHolding: (holdingId: string) => Promise<ActionResult>;
  onUpsertSnapshot: (
    input: InvestmentSnapshotFormInput,
  ) => Promise<ActionResult<InvestmentSnapshotDTO>>;
  onDeleteSnapshot: (snapshotId: string) => Promise<ActionResult>;
  onRecordDca: (input: RecordDcaExecutionInput) => Promise<
    ActionResult<{
      log: InvestmentDcaLogDTO;
      updatedHolding: InvestmentHoldingDTO;
    }>
  >;
  onDeleteDcaLog: (
    logId: string,
  ) => Promise<ActionResult<{ updatedHolding: InvestmentHoldingDTO | null }>>;
  onRecordDividend: (
    input: RecordDividendInput,
  ) => Promise<ActionResult<{ updatedHolding: InvestmentHoldingDTO }>>;
  onImportLocalWorkspace: (raw: unknown) => Promise<
    ActionResult<{
      settings: InvestmentPlanSettingsDTO | null;
      holdings: InvestmentHoldingDTO[];
      snapshots: InvestmentSnapshotDTO[];
    }>
  >;
}

export interface InvestmentsViewProps {
  storageKey?: string;
  persistenceMode?: "local" | "database";
  initialSettings?: InvestmentPlanSettingsDTO | null;
  initialHoldings?: InvestmentHoldingDTO[];
  initialSnapshots?: InvestmentSnapshotDTO[];
  initialDcaLogs?: InvestmentDcaLogDTO[];
  wallets?: WalletDTO[];
  incomeCategories?: CategoryDTO[];
  dbHandlers?: InvestmentsViewDbHandlers;
  currentGregorianYear: number;
  currentMonthKey: string;
  todayIso?: string;
  linkedInvestmentWalletTotal?: string;
  linkedInvestmentWalletCount?: number;
  linkedPlanDcaMonthly?: string;
}

export function InvestmentsView({
  storageKey = "moneyflow_investments_ui_v1",
  persistenceMode = "local",
  initialSettings: serverSettings = null,
  initialHoldings: serverHoldings,
  initialSnapshots: serverSnapshots,
  initialDcaLogs: serverDcaLogs,
  wallets = [],
  incomeCategories = [],
  dbHandlers,
  currentGregorianYear,
  currentMonthKey,
  todayIso = getBangkokToday(),
  linkedInvestmentWalletTotal = "0.00",
  linkedInvestmentWalletCount = 0,
  linkedPlanDcaMonthly = "0.00",
}: InvestmentsViewProps) {
  const isDbMode = persistenceMode === "database" && Boolean(dbHandlers);

  const initialSettings = useMemo<InvestmentPlanSettingsDTO>(() => {
    if (serverSettings) {
      return serverSettings;
    }
    const hasLinkedDca = toDecimal(linkedPlanDcaMonthly).gt(0);
    const hasLinkedWallet = toDecimal(linkedInvestmentWalletTotal).gt(0);
    return {
      ...DEFAULT_INVESTMENT_SETTINGS,
      startingPrincipal: hasLinkedWallet
        ? linkedInvestmentWalletTotal
        : DEFAULT_INVESTMENT_SETTINGS.startingPrincipal,
      monthlyDca: hasLinkedDca
        ? linkedPlanDcaMonthly
        : DEFAULT_INVESTMENT_SETTINGS.monthlyDca,
    };
  }, [serverSettings, linkedInvestmentWalletTotal, linkedPlanDcaMonthly]);

  const [settings, setSettings] =
    useState<InvestmentPlanSettingsDTO>(initialSettings);
  const [holdings, setHoldings] = useState<InvestmentHoldingDTO[]>(() =>
    isDbMode
      ? (serverHoldings ?? [])
      : (serverHoldings ?? DEFAULT_INVESTMENT_HOLDINGS),
  );
  const [snapshots, setSnapshots] = useState<InvestmentSnapshotDTO[]>(
    () => serverSnapshots ?? [],
  );
  const [dcaLogs, setDcaLogs] = useState<InvestmentDcaLogDTO[]>(
    () => serverDcaLogs ?? [],
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsSaveState, setSettingsSaveState] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [pendingLocalImport, setPendingLocalImport] =
    useState<PersistedInvestmentWorkspace | null>(null);
  const hasLoadedStorageRef = useRef(false);
  const hasUserEditedSettingsRef = useRef(false);

  // Local text inputs for smooth typing in simulator
  const [goalInput, setGoalInput] = useState(initialSettings.targetGoalAmount);
  const [principalInput, setPrincipalInput] = useState(
    initialSettings.startingPrincipal,
  );
  const [monthlyDcaInput, setMonthlyDcaInput] = useState(
    initialSettings.monthlyDca,
  );
  const [returnInput, setReturnInput] = useState(
    String(initialSettings.expectedAnnualReturnPct),
  );
  const [horizonInput, setHorizonInput] = useState(
    String(initialSettings.horizonYears),
  );
  const [stepUpInput, setStepUpInput] = useState(
    String(initialSettings.annualDcaStepUpPct),
  );

  // Dialog states (each form resets cleanly via formKey)
  const [simulatorDialogOpen, setSimulatorDialogOpen] = useState(false);

  const [holdingDialogOpen, setHoldingDialogOpen] = useState(false);
  const [holdingFormKey, setHoldingFormKey] = useState(0);
  const [editingHolding, setEditingHolding] =
    useState<InvestmentHoldingDTO | null>(null);

  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [snapshotFormKey, setSnapshotFormKey] = useState(0);

  const [dcaDialogOpen, setDcaDialogOpen] = useState(false);
  const [dcaFormKey, setDcaFormKey] = useState(0);
  const [dcaHolding, setDcaHolding] = useState<InvestmentHoldingDTO | null>(
    null,
  );
  const [dcaSuggestedAmount, setDcaSuggestedAmount] = useState<
    string | undefined
  >(undefined);

  const [divDialogOpen, setDivDialogOpen] = useState(false);
  const [divFormKey, setDivFormKey] = useState(0);
  const [divHolding, setDivHolding] = useState<InvestmentHoldingDTO | null>(
    null,
  );

  // Hydrate from localStorage in local mode, or detect one-time migration in DB mode
  useEffect(() => {
    if (isDbMode) {
      if (
        (serverHoldings?.length ?? 0) === 0 &&
        (serverSnapshots?.length ?? 0) === 0
      ) {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            const saved = JSON.parse(raw) as PersistedInvestmentWorkspace;
            if (
              (Array.isArray(saved.holdings) && saved.holdings.length > 0) ||
              (Array.isArray(saved.snapshots) && saved.snapshots.length > 0)
            ) {
              queueMicrotask(() => setPendingLocalImport(saved));
            }
          }
        } catch {
          // Ignore malformed legacy localStorage data
        }
      }
      hasLoadedStorageRef.current = true;
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedInvestmentWorkspace;
        queueMicrotask(() => {
          if (saved.settings) {
            setSettings(saved.settings);
            setGoalInput(saved.settings.targetGoalAmount);
            setPrincipalInput(saved.settings.startingPrincipal);
            setMonthlyDcaInput(saved.settings.monthlyDca);
            setReturnInput(String(saved.settings.expectedAnnualReturnPct));
            setHorizonInput(String(saved.settings.horizonYears));
            setStepUpInput(String(saved.settings.annualDcaStepUpPct));
          }
          if (Array.isArray(saved.holdings)) {
            setHoldings(saved.holdings);
          }
          if (Array.isArray(saved.snapshots)) {
            setSnapshots(saved.snapshots);
          }
          if (Array.isArray(saved.dcaLogs)) {
            setDcaLogs(saved.dcaLogs);
          }
          hasLoadedStorageRef.current = true;
        });
        return;
      }
    } catch {
      // Ignore malformed storage payload
    }
    hasLoadedStorageRef.current = true;
  }, [isDbMode, storageKey, serverHoldings?.length, serverSnapshots?.length]);

  // Persist to localStorage only in local/demo mode
  useEffect(() => {
    if (isDbMode || !hasLoadedStorageRef.current) return;
    try {
      const payload: PersistedInvestmentWorkspace = {
        settings,
        holdings,
        snapshots,
        dcaLogs,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Ignore quota errors in private browsing
    }
  }, [isDbMode, storageKey, settings, holdings, snapshots, dcaLogs]);

  // Debounced auto-save for simulator settings in DB mode
  useEffect(() => {
    if (!isDbMode || !dbHandlers || !hasUserEditedSettingsRef.current) return;
    const timer = setTimeout(async () => {
      setSettingsSaveState("saving");
      const res = await dbHandlers.onSaveSettings(settings);
      if (res.ok) {
        setSettingsSaveState("saved");
      } else {
        setSettingsSaveState("idle");
        toast.error("บันทึกแผนไม่สำเร็จ", res.error);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [isDbMode, dbHandlers, settings]);

  const portfolio = useMemo(
    () => computeInvestmentPortfolioSummary(holdings, settings),
    [holdings, settings],
  );

  const projection = useMemo(
    () => buildInvestmentProjection(settings, currentGregorianYear),
    [settings, currentGregorianYear],
  );

  const monthlyChecklist = useMemo(
    () =>
      buildMonthlyDcaChecklist(holdings, settings, dcaLogs, currentMonthKey),
    [holdings, settings, dcaLogs, currentMonthKey],
  );

  const sortedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
    [snapshots],
  );

  const existingSymbolSet = useMemo(
    () => new Set(holdings.map((h) => h.symbol.trim().toUpperCase())),
    [holdings],
  );

  function updateSettingField<K extends keyof InvestmentPlanSettingsDTO>(
    key: K,
    value: InvestmentPlanSettingsDTO[K],
  ) {
    hasUserEditedSettingsRef.current = true;
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleGoalChange(val: string) {
    setGoalInput(val);
    updateSettingField("targetGoalAmount", parseSafeNonNegative(val, "0.00"));
  }

  function handlePrincipalChange(val: string) {
    setPrincipalInput(val);
    updateSettingField("startingPrincipal", parseSafeNonNegative(val, "0.00"));
  }

  function handleMonthlyDcaChange(val: string) {
    setMonthlyDcaInput(val);
    updateSettingField("monthlyDca", parseSafeNonNegative(val, "0.00"));
  }

  function handleReturnChange(val: string) {
    setReturnInput(val);
    const num = Number(val);
    if (Number.isFinite(num) && num >= 0 && num <= 50) {
      updateSettingField("expectedAnnualReturnPct", num);
    }
  }

  function handleHorizonChange(val: string) {
    setHorizonInput(val);
    const num = Number(val);
    if (Number.isFinite(num) && num >= 1 && num <= 40) {
      updateSettingField("horizonYears", Math.round(num));
    }
  }

  function handleStepUpChange(val: string) {
    setStepUpInput(val);
    const num = Number(val);
    if (Number.isFinite(num) && num >= 0 && num <= 30) {
      updateSettingField("annualDcaStepUpPct", num);
    }
  }

  function handleResetSample() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage error
    }
    setSettings(initialSettings);
    setGoalInput(initialSettings.targetGoalAmount);
    setPrincipalInput(initialSettings.startingPrincipal);
    setMonthlyDcaInput(initialSettings.monthlyDca);
    setReturnInput(String(initialSettings.expectedAnnualReturnPct));
    setHorizonInput(String(initialSettings.horizonYears));
    setStepUpInput(String(initialSettings.annualDcaStepUpPct));
    setHoldings(DEFAULT_INVESTMENT_HOLDINGS);
    setSnapshots([]);
    setNotice("รีเซ็ตข้อมูลหน้าการลงทุนกลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว");
  }

  function openAddHolding() {
    setEditingHolding(null);
    setHoldingFormKey((k) => k + 1);
    setHoldingDialogOpen(true);
  }

  function openEditHolding(item: InvestmentHoldingDTO) {
    setEditingHolding(item);
    setHoldingFormKey((k) => k + 1);
    setHoldingDialogOpen(true);
  }

  function openAddSnapshot() {
    setSnapshotFormKey((k) => k + 1);
    setSnapshotDialogOpen(true);
  }

  function openRecordDca(
    holding: InvestmentHoldingDTO,
    suggestedAmount?: string,
  ) {
    setDcaHolding(holding);
    setDcaSuggestedAmount(suggestedAmount);
    setDcaFormKey((k) => k + 1);
    setDcaDialogOpen(true);
  }

  function openRecordDividend(holding: InvestmentHoldingDTO) {
    setDivHolding(holding);
    setDivFormKey((k) => k + 1);
    setDivDialogOpen(true);
  }

  async function handleQuickAddPreset(preset: InvestmentHoldingPreset) {
    const inferredCurrency: InvestmentCurrency =
      preset.assetType === "etf" ? "USD" : "THB";
    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onUpsertHolding({
          symbol: preset.symbol,
          name: preset.name,
          assetType: preset.assetType,
          targetAllocationPct: preset.targetAllocationPct,
          expectedAnnualReturnPct: preset.expectedAnnualReturnPct,
          investedCost: "0.00",
          currentValue: "0.00",
          dividendsReceived: "0.00",
          units: null,
          currency: inferredCurrency,
          broker: preset.broker,
          note: preset.note,
          color: preset.color,
        });
        if (!res.ok || !res.data) {
          toast.error("เพิ่มสินทรัพย์ไม่สำเร็จ", res.error);
          return;
        }
        setHoldings((prev) => [...prev, res.data!]);
        toast.success(`เพิ่ม ${preset.symbol} เข้าพอร์ตแล้ว`);
      } finally {
        setIsMutating(false);
      }
      return;
    }

    const newItem: InvestmentHoldingDTO = {
      id: crypto.randomUUID(),
      symbol: preset.symbol,
      name: preset.name,
      assetType: preset.assetType,
      targetAllocationPct: preset.targetAllocationPct,
      expectedAnnualReturnPct: preset.expectedAnnualReturnPct,
      investedCost: "0.00",
      currentValue: "0.00",
      dividendsReceived: "0.00",
      units: null,
      currency: inferredCurrency,
      broker: preset.broker,
      note: preset.note,
      color: preset.color,
    };
    setHoldings((prev) => [...prev, newItem]);
    setNotice(`เพิ่ม ${preset.symbol} เข้าในรายการวางแผน DCA แล้ว`);
  }

  async function handleHoldingSubmit(
    payload: InvestmentHoldingFormInput,
    editingId?: string,
  ): Promise<string | null> {
    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onUpsertHolding(payload, editingId);
        if (!res.ok || !res.data) {
          return res.error ?? "ไม่สามารถบันทึกข้อมูลสินทรัพย์ได้";
        }
        const saved = res.data;
        setHoldings((prev) =>
          editingId
            ? prev.map((item) => (item.id === editingId ? saved : item))
            : [...prev, saved],
        );
        toast.success(
          editingId
            ? `อัปเดต ${saved.symbol} เรียบร้อยแล้ว`
            : `เพิ่ม ${saved.symbol} เข้าพอร์ตแล้ว`,
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    }

    const nextItem: InvestmentHoldingDTO = {
      id: editingId ?? crypto.randomUUID(),
      ...payload,
      broker: payload.broker ?? null,
      note: payload.note ?? null,
      color: payload.color ?? HOLDING_COLOR_PRESETS[0],
    };

    setHoldings((prev) =>
      editingId
        ? prev.map((item) => (item.id === editingId ? nextItem : item))
        : [...prev, nextItem],
    );
    setNotice(
      editingId
        ? `อัปเดตข้อมูล ${nextItem.symbol} เรียบร้อยแล้ว`
        : `เพิ่ม ${nextItem.symbol} เข้าพอร์ตจำลองเรียบร้อยแล้ว`,
    );
    return null;
  }

  async function handleDeleteHolding(id: string) {
    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onDeleteHolding(id);
        if (!res.ok) {
          toast.error("ลบสินทรัพย์ไม่สำเร็จ", res.error);
          return;
        }
        setHoldings((prev) => prev.filter((item) => item.id !== id));
        setDcaLogs((prev) => prev.filter((log) => log.holdingId !== id));
        toast.success("ลบสินทรัพย์ออกจากพอร์ตแล้ว");
      } finally {
        setIsMutating(false);
      }
      return;
    }
    setHoldings((prev) => prev.filter((item) => item.id !== id));
    setDcaLogs((prev) => prev.filter((log) => log.holdingId !== id));
  }

  async function handleSnapshotSubmit(
    snapInput: InvestmentSnapshotFormInput,
  ): Promise<string | null> {
    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onUpsertSnapshot(snapInput);
        if (!res.ok || !res.data) {
          return res.error ?? "ไม่สามารถบันทึกยอดพอร์ตประจำเดือนได้";
        }
        const saved = res.data;
        setSnapshots((prev) => [
          saved,
          ...prev.filter((s) => s.monthKey !== saved.monthKey),
        ]);
        toast.success(
          `บันทึกยอดพอร์ต ${formatMonthKeyThai(saved.monthKey)} แล้ว`,
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    }

    const nextSnap: InvestmentSnapshotDTO = {
      id: crypto.randomUUID(),
      ...snapInput,
      note: snapInput.note ?? null,
    };

    setSnapshots((prev) => {
      const filtered = prev.filter((s) => s.monthKey !== snapInput.monthKey);
      return [nextSnap, ...filtered];
    });
    setNotice(
      `บันทึกยอดพอร์ตประจำเดือน ${formatMonthKeyThai(snapInput.monthKey)} เรียบร้อยแล้ว`,
    );
    return null;
  }

  async function handleDeleteSnapshot(id: string) {
    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onDeleteSnapshot(id);
        if (!res.ok) {
          toast.error("ลบประวัติไม่สำเร็จ", res.error);
          return;
        }
        setSnapshots((prev) => prev.filter((s) => s.id !== id));
        toast.success("ลบรายการยอดพอร์ตแล้ว");
      } finally {
        setIsMutating(false);
      }
      return;
    }
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleDcaSubmit(
    holding: InvestmentHoldingDTO,
    input: RecordDcaExecutionInput,
  ): Promise<string | null> {
    const amtDec = toDecimal(input.amountThb);
    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onRecordDca(input);
        if (!res.ok || !res.data) {
          return res.error ?? "ไม่สามารถบันทึกการซื้อ DCA ได้";
        }
        setDcaLogs((prev) => [res.data!.log, ...prev]);
        setHoldings((prev) =>
          prev.map((h) =>
            h.id === res.data!.updatedHolding.id ? res.data!.updatedHolding : h,
          ),
        );
        toast.success(
          `บันทึกซื้อ DCA ${holding.symbol} ฿${formatMoneyDisplay(amtDec)} แล้ว`,
          input.createTransferTransaction
            ? "โอนเงินเข้ากระเป๋าลงทุนและบวกต้นทุนพอร์ตให้อัตโนมัติ"
            : "อัปเดตต้นทุนสะสมในพอร์ตเรียบร้อยแล้ว",
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    }

    const math = applyDcaPurchaseMath({
      currentInvestedCost: holding.investedCost,
      currentValue: holding.currentValue,
      currentUnits: holding.units,
      amountThb: input.amountThb,
      unitsBought: input.unitsBought,
    });
    const localLog: InvestmentDcaLogDTO = {
      id: crypto.randomUUID(),
      holdingId: holding.id,
      holdingSymbol: holding.symbol,
      holdingName: holding.name,
      transactionId: null,
      executedDate: input.executedDate,
      amountThb: input.amountThb,
      unitsBought: input.unitsBought ?? null,
      pricePerUnit: input.pricePerUnit ?? null,
      feeThb: input.feeThb ?? "0.00",
      note: input.note ?? null,
    };
    setDcaLogs((prev) => [localLog, ...prev]);
    setHoldings((prev) =>
      prev.map((h) =>
        h.id === holding.id
          ? {
              ...h,
              investedCost: math.nextInvestedCost,
              currentValue: math.nextCurrentValue,
              units: math.nextUnits,
            }
          : h,
      ),
    );
    toast.success(
      `บันทึกซื้อ DCA ${holding.symbol} ฿${formatMoneyDisplay(amtDec)} แล้ว`,
    );
    return null;
  }

  async function handleDeleteDcaLog(log: InvestmentDcaLogDTO) {
    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onDeleteDcaLog(log.id);
        if (!res.ok) {
          toast.error("ลบประวัติ DCA ไม่สำเร็จ", res.error);
          return;
        }
        setDcaLogs((prev) => prev.filter((item) => item.id !== log.id));
        if (res.data?.updatedHolding) {
          const updated = res.data.updatedHolding;
          setHoldings((prev) =>
            prev.map((h) => (h.id === updated.id ? updated : h)),
          );
        }
        toast.success(
          `ยกเลิกรายการ DCA ${log.holdingSymbol} แล้ว`,
          log.transactionId
            ? "ปรับต้นทุนพอร์ตและลบรายการโอนที่ผูกไว้คืนให้เรียบร้อย"
            : "ปรับยอดต้นทุนพอร์ตคืนให้เรียบร้อย",
        );
      } finally {
        setIsMutating(false);
      }
      return;
    }

    setDcaLogs((prev) => prev.filter((item) => item.id !== log.id));
    setHoldings((prev) =>
      prev.map((h) => {
        if (h.id !== log.holdingId) return h;
        const math = reverseDcaPurchaseMath({
          currentInvestedCost: h.investedCost,
          currentValue: h.currentValue,
          currentUnits: h.units,
          amountThb: log.amountThb,
          unitsBought: log.unitsBought,
        });
        return {
          ...h,
          investedCost: math.nextInvestedCost,
          currentValue: math.nextCurrentValue,
          units: math.nextUnits,
        };
      }),
    );
  }

  async function handleDividendSubmit(
    holding: InvestmentHoldingDTO,
    input: RecordDividendInput,
  ): Promise<string | null> {
    const amtDec = toDecimal(input.amountThb);
    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onRecordDividend(input);
        if (!res.ok || !res.data) {
          return res.error ?? "ไม่สามารถบันทึกเงินปันผลได้";
        }
        const updated = res.data.updatedHolding;
        setHoldings((prev) =>
          prev.map((h) => (h.id === updated.id ? updated : h)),
        );
        toast.success(
          `บันทึกปันผล ${holding.symbol} +฿${formatMoneyDisplay(amtDec)} แล้ว`,
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    }

    setHoldings((prev) =>
      prev.map((h) =>
        h.id === holding.id
          ? {
              ...h,
              dividendsReceived: toDecimal(h.dividendsReceived)
                .plus(amtDec)
                .toFixed(2),
            }
          : h,
      ),
    );
    toast.success(
      `บันทึกปันผล ${holding.symbol} +฿${formatMoneyDisplay(amtDec)} แล้ว`,
    );
    return null;
  }

  async function handleImportLocalWorkspace() {
    if (!isDbMode || !dbHandlers || !pendingLocalImport) return;
    setIsMutating(true);
    try {
      const res = await dbHandlers.onImportLocalWorkspace(pendingLocalImport);
      if (!res.ok || !res.data) {
        toast.error("นำเข้าข้อมูลไม่สำเร็จ", res.error);
        return;
      }
      if (res.data.settings) {
        const s = res.data.settings;
        setSettings(s);
        setGoalInput(s.targetGoalAmount);
        setPrincipalInput(s.startingPrincipal);
        setMonthlyDcaInput(s.monthlyDca);
        setReturnInput(String(s.expectedAnnualReturnPct));
        setHorizonInput(String(s.horizonYears));
        setStepUpInput(String(s.annualDcaStepUpPct));
      }
      setHoldings(res.data.holdings);
      setSnapshots(res.data.snapshots);
      setPendingLocalImport(null);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore storage cleanup errors
      }
      toast.success(
        "ย้ายแผนลงทุนเข้า PostgreSQL สำเร็จ",
        `นำเข้า ${res.data.holdings.length} สินทรัพย์ และ ${res.data.snapshots.length} รายการย้อนหลังแล้ว`,
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRefreshPrices() {
    if (!isDbMode || isRefreshingPrices) return;
    setIsRefreshingPrices(true);
    try {
      const response = await fetch("/api/investments/refresh-prices", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        updatedCount?: number;
        skippedCount?: number;
        failedSymbols?: string[];
        usdThbRate?: number | null;
        updatedHoldings?: Array<{
          id: string;
          symbol: string;
          currentValue: string;
          currency: InvestmentCurrency;
          unitPrice: number;
        }>;
      } | null;

      if (!response.ok) {
        toast.error(
          "อัปเดตราคาตลาดไม่สำเร็จ",
          payload?.error ?? "ไม่สามารถเชื่อมต่อแหล่งข้อมูลราคาได้",
        );
        return;
      }

      const updatedList = payload?.updatedHoldings ?? [];
      if (updatedList.length > 0) {
        const updateMap = new Map(updatedList.map((u) => [u.id, u]));
        setHoldings((prev) =>
          prev.map((h) => {
            const hit = updateMap.get(h.id);
            return hit
              ? {
                  ...h,
                  currentValue: hit.currentValue,
                  currency: hit.currency,
                }
              : h;
          }),
        );
        const fxInfo = payload?.usdThbRate
          ? ` (USD/THB ≈ ${payload.usdThbRate.toFixed(2)})`
          : "";
        const failInfo =
          payload?.failedSymbols && payload.failedSymbols.length > 0
            ? ` · ดึงไม่ได้: ${payload.failedSymbols.join(", ")}`
            : "";
        toast.success(
          `อัปเดตราคาตลาดแล้ว ${updatedList.length} รายการ${fxInfo}`,
          failInfo || "คำนวณมูลค่าพอร์ตเป็นเงินบาทล่าสุดเรียบร้อย",
        );
      } else {
        toast.warning(
          "ยังไม่มีรายการที่อัปเดตราคาได้",
          payload?.message ??
            "กรอกจำนวนหน่วย (Units > 0) ในหุ้น/ETF ที่มี Ticker มาตรฐาน เช่น VOO, QQQM, PTT.BK ก่อนนะครับ",
        );
      }
    } catch {
      toast.error(
        "เชื่อมต่อดึงราคาตลาดไม่สำเร็จ",
        "ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง",
      );
    } finally {
      setIsRefreshingPrices(false);
    }
  }

  function handleUseSnapshotAsPrincipal(snap: InvestmentSnapshotDTO) {
    handlePrincipalChange(snap.marketValue);
    setNotice(
      `นำมูลค่าพอร์ตเดือน ${formatMonthKeyThai(snap.monthKey)} (฿${formatMoneyDisplay(snap.marketValue)}) ไปใส่ในตัวจำลองด้านบนแล้ว`,
    );
  }

  const displayedPortfolioValue = portfolio.hasRealTrackingData
    ? portfolio.totalCurrentValue
    : settings.startingPrincipal;
  const displayedGainDec = toDecimal(portfolio.totalUnrealizedGain);

  const remainingTargetPct = Math.max(
    0,
    Math.round(100 - portfolio.totalTargetAllocationPct),
  );
  const defaultNewHoldingTargetPct = String(
    remainingTargetPct > 0 ? remainingTargetPct : 10,
  );
  const defaultNewHoldingColor =
    HOLDING_COLOR_PRESETS[holdings.length % HOLDING_COLOR_PRESETS.length];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              การลงทุน &amp; แผน DCA
            </h1>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isDbMode
              ? "วางแผน DCA ระยะยาว เช็กลิสต์ซื้อรายเดือน บันทึกต้นทุน-ปันผลจริง และซิงก์พอร์ตข้ามทุกอุปกรณ์"
              : "ดูภาพรวมผลตอบแทนโดยเฉลี่ย จำลองเป้าหมายพอร์ตระยะยาว และทดลองบันทึกซื้อ DCA รายเดือน"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isDbMode ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetSample}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>รีเซ็ตค่าเริ่มต้น</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSimulatorDialogOpen(true)}
            className="gap-1.5"
          >
            <Calculator className="h-3.5 w-3.5 text-teal-600" />
            <span>คำนวณแผนการลงทุน</span>
          </Button>
          <Button
            type="button"
            onClick={openAddHolding}
            disabled={isMutating}
            className="gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            <span>เพิ่มหุ้น / กองทุน</span>
          </Button>
        </div>
      </div>

      {isDbMode && pendingLocalImport ? (
        <div
          role="status"
          className="animate-mf-fade-up flex flex-col gap-2.5 rounded-xl border border-teal-600/35 bg-teal-600/10 p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <Download className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
            <div className="space-y-0.5">
              <p className="font-semibold text-teal-900 dark:text-teal-100">
                พบแผนลงทุนเดิมที่บันทึกไว้ในเบราว์เซอร์นี้
              </p>
              <p className="text-xs text-teal-800/80 dark:text-teal-200/80">
                มี {pendingLocalImport.holdings?.length ?? 0} สินทรัพย์ และ{" "}
                {pendingLocalImport.snapshots?.length ?? 0} ประวัติรายเดือน —
                นำเข้าสู่บัญชี PostgreSQL เพื่อซิงก์กับ iPhone/iPad
                ได้ในคลิกเดียว
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPendingLocalImport(null)}
            >
              ข้ามไปก่อน
            </Button>
            <Button
              type="button"
              size="sm"
              loading={isMutating}
              loadingText="กำลังนำเข้า..."
              onClick={handleImportLocalWorkspace}
              className="gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
            >
              <Download className="h-3.5 w-3.5" />
              <span>นำเข้าลงบัญชี</span>
            </Button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          className="animate-mf-fade-up flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 text-xs font-medium underline underline-offset-2"
          >
            ปิด
          </button>
        </div>
      ) : null}

      {/* KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-teal-600" />
              {portfolio.hasRealTrackingData
                ? "มูลค่าพอร์ตจริงปัจจุบัน"
                : "เงินลงทุนตั้งต้น"}
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              ฿{formatMoneyDisplay(displayedPortfolioValue)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground tabular-nums">
            {portfolio.hasRealTrackingData ? (
              <span>
                ต้นทุน ฿{formatMoneyDisplay(portfolio.totalInvestedCost)} •{" "}
                <strong
                  className={
                    displayedGainDec.gte(0)
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }
                >
                  {displayedGainDec.gte(0) ? "+" : "-"}฿
                  {formatMoneyDisplay(displayedGainDec.abs())} (
                  {displayedGainDec.gte(0) ? "+" : ""}
                  {portfolio.totalUnrealizedGainPct}%)
                </strong>
              </span>
            ) : linkedInvestmentWalletCount > 0 ? (
              `ยอดในกระเป๋าพอร์ตหุ้นตอนนี้: ฿${formatMoneyDisplay(linkedInvestmentWalletTotal)}`
            ) : (
              "โหมดจำลองแผน (ยังไม่ได้กรอกยอดพอร์ตจริง)"
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-sky-600" />
              ยอดลงทุน DCA ต่อเดือน
            </CardDescription>
            <CardTitle className="text-2xl text-sky-600 tabular-nums">
              ฿{formatMoneyDisplay(settings.monthlyDca)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / ด.
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground tabular-nums">
            ปีแรกออมลงทุนรวม ฿
            {formatMoneyDisplay(toDecimal(settings.monthlyDca).times(12))}
            {settings.annualDcaStepUpPct > 0
              ? ` • เพิ่มปีละ +${settings.annualDcaStepUpPct}%`
              : ""}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              ผลตอบแทนเฉลี่ยคาดหวัง
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-600 tabular-nums">
              {settings.expectedAnnualReturnPct}%
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / ปี
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground tabular-nums">
            {holdings.length > 0
              ? `ค่าเฉลี่ยถ่วงน้ำหนักจากพอร์ต: ${portfolio.weightedExpectedReturnPct}% / ปี`
              : "ค่าอ้างอิงทบต้นรายเดือนระยะยาว"}
          </CardContent>
        </Card>

        <Card className="border-teal-600/30 bg-teal-700/5">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300">
              <Target className="h-4 w-4" />
              ระยะเวลาถึงเป้า ฿{formatMoneyDisplay(settings.targetGoalAmount)}
            </CardDescription>
            <CardTitle className="text-2xl text-teal-700 tabular-nums dark:text-teal-300">
              {formatMonthsToYearsThai(projection.monthsToGoal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground tabular-nums">
            {projection.targetBuddhistYear
              ? `คาดว่าถึงเป้าหมายในปี พ.ศ. ${projection.targetBuddhistYear}`
              : "ลองเพิ่มยอด DCA ต่อเดือน หรือปรับเป้าหมาย"}
          </CardContent>
        </Card>
      </div>

      {/* Simulator Dialog & Charts */}
      <InvestmentSimulatorCard
        open={simulatorDialogOpen}
        onOpenChange={setSimulatorDialogOpen}
        isDbMode={isDbMode}
        settingsSaveState={settingsSaveState}
        settings={settings}
        portfolio={portfolio}
        projection={projection}
        holdingsCount={holdings.length}
        currentGregorianYear={currentGregorianYear}
        linkedInvestmentWalletTotal={linkedInvestmentWalletTotal}
        linkedPlanDcaMonthly={linkedPlanDcaMonthly}
        displayedPortfolioValue={displayedPortfolioValue}
        goalInput={goalInput}
        principalInput={principalInput}
        monthlyDcaInput={monthlyDcaInput}
        returnInput={returnInput}
        horizonInput={horizonInput}
        stepUpInput={stepUpInput}
        onGoalChange={handleGoalChange}
        onPrincipalChange={handlePrincipalChange}
        onMonthlyDcaChange={handleMonthlyDcaChange}
        onReturnChange={handleReturnChange}
        onHorizonChange={handleHorizonChange}
        onStepUpChange={handleStepUpChange}
      />

      {/* Checklist, Holdings & Monthly Snapshots */}
      <InvestmentHoldingsSection
        isDbMode={isDbMode}
        isMutating={isMutating}
        isRefreshingPrices={isRefreshingPrices}
        currentMonthKey={currentMonthKey}
        holdings={holdings}
        portfolio={portfolio}
        monthlyChecklist={monthlyChecklist}
        dcaLogs={dcaLogs}
        sortedSnapshots={sortedSnapshots}
        existingSymbolSet={existingSymbolSet}
        onOpenAddHolding={openAddHolding}
        onOpenEditHolding={openEditHolding}
        onDeleteHolding={handleDeleteHolding}
        onQuickAddPreset={handleQuickAddPreset}
        onOpenRecordDca={openRecordDca}
        onDeleteDcaLog={handleDeleteDcaLog}
        onOpenRecordDividend={openRecordDividend}
        onRefreshPrices={handleRefreshPrices}
        onOpenAddSnapshot={openAddSnapshot}
        onDeleteSnapshot={handleDeleteSnapshot}
        onUseSnapshotAsPrincipal={handleUseSnapshotAsPrincipal}
      />

      {/* Modals */}
      <InvestmentHoldingDialog
        open={holdingDialogOpen}
        formKey={holdingFormKey}
        onOpenChange={setHoldingDialogOpen}
        editingHolding={editingHolding}
        defaultTargetPct={defaultNewHoldingTargetPct}
        defaultColor={defaultNewHoldingColor}
        isMutating={isMutating}
        onSubmit={handleHoldingSubmit}
      />

      <InvestmentSnapshotDialog
        open={snapshotDialogOpen}
        formKey={snapshotFormKey}
        onOpenChange={setSnapshotDialogOpen}
        defaultMonthKey={currentMonthKey}
        defaultInvestedCost={
          portfolio.hasRealTrackingData
            ? portfolio.totalInvestedCost
            : settings.startingPrincipal
        }
        defaultMarketValue={
          portfolio.hasRealTrackingData
            ? portfolio.totalCurrentValue
            : settings.startingPrincipal
        }
        isMutating={isMutating}
        onSubmit={handleSnapshotSubmit}
      />

      <InvestmentDcaDialog
        open={dcaDialogOpen}
        formKey={dcaFormKey}
        onOpenChange={setDcaDialogOpen}
        holding={dcaHolding}
        suggestedAmount={dcaSuggestedAmount}
        todayIso={todayIso}
        isDbMode={isDbMode}
        wallets={wallets}
        isMutating={isMutating}
        onSubmit={handleDcaSubmit}
      />

      <InvestmentDividendDialog
        open={divDialogOpen}
        formKey={divFormKey}
        onOpenChange={setDivDialogOpen}
        holding={divHolding}
        todayIso={todayIso}
        isDbMode={isDbMode}
        wallets={wallets}
        incomeCategories={incomeCategories}
        isMutating={isMutating}
        onSubmit={handleDividendSubmit}
      />
    </div>
  );
}
