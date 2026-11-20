"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Database,
  Download,
  History,
  LineChart,
  Loader2,
  Pencil,
  PieChart as PieChartIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type {
  InvestmentHoldingFormInput,
  InvestmentSnapshotFormInput,
  RecordDcaExecutionInput,
  RecordDividendInput,
} from "@/actions/investments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSelect } from "@/components/ui/select";
import { SmoothExpand } from "@/components/ui/smooth-expand";
import { toast } from "@/components/ui/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIsoDateForDisplay, getBangkokToday } from "@/lib/date";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import {
  applyDcaPurchaseMath,
  buildInvestmentProjection,
  buildMonthlyDcaChecklist,
  computeInvestmentPortfolioSummary,
  DEFAULT_INVESTMENT_HOLDINGS,
  DEFAULT_INVESTMENT_SETTINGS,
  formatMonthsToYearsThai,
  INVESTMENT_ASSET_TYPE_META,
  POPULAR_DCA_PRESETS,
  reverseDcaPurchaseMath,
  type InvestmentHoldingPreset,
} from "@/lib/investment-calc";
import type {
  ActionResult,
  CategoryDTO,
  InvestmentAssetType,
  InvestmentCurrency,
  InvestmentDcaLogDTO,
  InvestmentHoldingDTO,
  InvestmentPlanSettingsDTO,
  InvestmentSnapshotDTO,
  WalletDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const InvestmentProjectionChart = dynamic(
  () =>
    import("./investment-charts").then((m) => m.InvestmentProjectionChart),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted sm:h-72" />,
  }
);

const InvestmentAllocationDonutChart = dynamic(
  () =>
    import("./investment-charts").then((m) => m.InvestmentAllocationDonutChart),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
  }
);

const HOLDING_COLOR_PRESETS = [
  "#0f766e",
  "#10b981",
  "#3b82f6",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#f97316",
  "#ec4899",
  "#64748b",
];

const GOAL_PRESETS = [
  { label: "5 แสน", value: "500000" },
  { label: "1 ล้าน", value: "1000000" },
  { label: "2 ล้าน", value: "2000000" },
  { label: "5 ล้าน", value: "5000000" },
  { label: "10 ล้าน", value: "10000000" },
];

const RETURN_PRESETS = [
  { label: "5% เสี่ยงต่ำ", value: 5 },
  { label: "8% S&P 500 เฉลี่ย", value: 8 },
  { label: "10% เติบโตสูง", value: 10 },
];

const HORIZON_PRESETS = [5, 10, 15, 20, 30];

interface PersistedInvestmentWorkspace {
  settings?: InvestmentPlanSettingsDTO;
  holdings?: InvestmentHoldingDTO[];
  snapshots?: InvestmentSnapshotDTO[];
  dcaLogs?: InvestmentDcaLogDTO[];
}

export interface InvestmentsViewDbHandlers {
  onSaveSettings: (
    settings: InvestmentPlanSettingsDTO
  ) => Promise<ActionResult>;
  onUpsertHolding: (
    input: InvestmentHoldingFormInput,
    editingId?: string
  ) => Promise<ActionResult<InvestmentHoldingDTO>>;
  onDeleteHolding: (holdingId: string) => Promise<ActionResult>;
  onUpsertSnapshot: (
    input: InvestmentSnapshotFormInput
  ) => Promise<ActionResult<InvestmentSnapshotDTO>>;
  onDeleteSnapshot: (snapshotId: string) => Promise<ActionResult>;
  onRecordDca: (
    input: RecordDcaExecutionInput
  ) => Promise<
    ActionResult<{
      log: InvestmentDcaLogDTO;
      updatedHolding: InvestmentHoldingDTO;
    }>
  >;
  onDeleteDcaLog: (
    logId: string
  ) => Promise<ActionResult<{ updatedHolding: InvestmentHoldingDTO | null }>>;
  onRecordDividend: (
    input: RecordDividendInput
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

function parseSafeNonNegative(raw: string, fallback = "0.00"): string {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return fallback;
  try {
    const d = toDecimal(cleaned);
    if (d.isNegative() || !d.isFinite()) return fallback;
    return d.toFixed(2);
  } catch {
    return fallback;
  }
}

function formatMonthKeyThai(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const thaiMonthsShort = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const y = Number(match[1]) + 543;
  const m = Number(match[2]);
  return `${thaiMonthsShort[m - 1] ?? match[2]} ${y}`;
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
    isDbMode ? (serverHoldings ?? []) : (serverHoldings ?? DEFAULT_INVESTMENT_HOLDINGS)
  );
  const [snapshots, setSnapshots] = useState<InvestmentSnapshotDTO[]>(
    () => serverSnapshots ?? []
  );
  const [dcaLogs, setDcaLogs] = useState<InvestmentDcaLogDTO[]>(
    () => serverDcaLogs ?? []
  );
  const [simulatorOpen, setSimulatorOpen] = useState(true);
  const [dcaLogsExpanded, setDcaLogsExpanded] = useState(false);
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
    initialSettings.startingPrincipal
  );
  const [monthlyDcaInput, setMonthlyDcaInput] = useState(
    initialSettings.monthlyDca
  );
  const [returnInput, setReturnInput] = useState(
    String(initialSettings.expectedAnnualReturnPct)
  );
  const [horizonInput, setHorizonInput] = useState(
    String(initialSettings.horizonYears)
  );
  const [stepUpInput, setStepUpInput] = useState(
    String(initialSettings.annualDcaStepUpPct)
  );

  // Add / Edit Holding Dialog state
  const [holdingDialogOpen, setHoldingDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] =
    useState<InvestmentHoldingDTO | null>(null);
  const [hSymbol, setHSymbol] = useState("");
  const [hName, setHName] = useState("");
  const [hAssetType, setHAssetType] = useState<InvestmentAssetType>("etf");
  const [hTargetPct, setHTargetPct] = useState("20");
  const [hExpectedReturn, setHExpectedReturn] = useState("8");
  const [hInvestedCost, setHInvestedCost] = useState("0");
  const [hCurrentValue, setHCurrentValue] = useState("0");
  const [hDividends, setHDividends] = useState("0");
  const [hUnits, setHUnits] = useState("");
  const [hCurrency, setHCurrency] = useState<InvestmentCurrency>("THB");
  const [hBroker, setHBroker] = useState("");
  const [hNote, setHNote] = useState("");
  const [hColor, setHColor] = useState(HOLDING_COLOR_PRESETS[0]);
  const [hError, setHError] = useState<string | null>(null);

  // Add Monthly Snapshot Dialog state
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [sMonthKey, setSMonthKey] = useState(currentMonthKey);
  const [sInvestedCost, setSInvestedCost] = useState("");
  const [sMarketValue, setSMarketValue] = useState("");
  const [sDividends, setSDividends] = useState("0");
  const [sNote, setSNote] = useState("");
  const [sError, setSError] = useState<string | null>(null);

  // Record DCA Execution Dialog state (Phase 9B)
  const [dcaDialogOpen, setDcaDialogOpen] = useState(false);
  const [dcaHolding, setDcaHolding] = useState<InvestmentHoldingDTO | null>(
    null
  );
  const [dDate, setDDate] = useState(todayIso);
  const [dAmountThb, setDAmountThb] = useState("");
  const [dUnitsBought, setDUnitsBought] = useState("");
  const [dPricePerUnit, setDPricePerUnit] = useState("");
  const [dFeeThb, setDFeeThb] = useState("0.00");
  const [dNote, setDNote] = useState("");
  const [dCreateTransfer, setDCreateTransfer] = useState(false);
  const [dSourceWalletId, setDSourceWalletId] = useState("");
  const [dTargetWalletId, setDTargetWalletId] = useState("");
  const [dError, setDError] = useState<string | null>(null);

  // Record Dividend Dialog state (Phase 9B)
  const [divDialogOpen, setDivDialogOpen] = useState(false);
  const [divHolding, setDivHolding] = useState<InvestmentHoldingDTO | null>(
    null
  );
  const [vDate, setVDate] = useState(todayIso);
  const [vAmountThb, setVAmountThb] = useState("");
  const [vNote, setVNote] = useState("");
  const [vCreateIncome, setVCreateIncome] = useState(false);
  const [vWalletId, setVWalletId] = useState("");
  const [vCategoryId, setVCategoryId] = useState("");
  const [vError, setVError] = useState<string | null>(null);

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
    [holdings, settings]
  );

  const projection = useMemo(
    () => buildInvestmentProjection(settings, currentGregorianYear),
    [settings, currentGregorianYear]
  );

  const monthlyChecklist = useMemo(
    () =>
      buildMonthlyDcaChecklist(holdings, settings, dcaLogs, currentMonthKey),
    [holdings, settings, dcaLogs, currentMonthKey]
  );

  const sortedSnapshots = useMemo(
    () => [...snapshots].sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
    [snapshots]
  );

  const existingSymbolSet = useMemo(
    () => new Set(holdings.map((h) => h.symbol.trim().toUpperCase())),
    [holdings]
  );

  function updateSettingField<K extends keyof InvestmentPlanSettingsDTO>(
    key: K,
    value: InvestmentPlanSettingsDTO[K]
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
    setHSymbol("");
    setHName("");
    setHAssetType("etf");
    const remainingPct = Math.max(
      0,
      Math.round(100 - portfolio.totalTargetAllocationPct)
    );
    setHTargetPct(String(remainingPct > 0 ? remainingPct : 10));
    setHExpectedReturn("8");
    setHInvestedCost("0.00");
    setHCurrentValue("0.00");
    setHDividends("0.00");
    setHUnits("");
    setHCurrency("THB");
    setHBroker("");
    setHNote("");
    setHColor(
      HOLDING_COLOR_PRESETS[holdings.length % HOLDING_COLOR_PRESETS.length]
    );
    setHError(null);
    setHoldingDialogOpen(true);
  }

  function openEditHolding(item: InvestmentHoldingDTO) {
    setEditingHolding(item);
    setHSymbol(item.symbol);
    setHName(item.name);
    setHAssetType(item.assetType);
    setHTargetPct(String(item.targetAllocationPct));
    setHExpectedReturn(String(item.expectedAnnualReturnPct));
    setHInvestedCost(item.investedCost);
    setHCurrentValue(item.currentValue);
    setHDividends(item.dividendsReceived);
    setHUnits(item.units ? String(Number(item.units)) : "");
    setHCurrency(item.currency ?? "THB");
    setHBroker(item.broker ?? "");
    setHNote(item.note ?? "");
    setHColor(item.color);
    setHError(null);
    setHoldingDialogOpen(true);
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

  async function handleHoldingSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHError(null);

    const symbol = hSymbol.trim().toUpperCase();
    const name = hName.trim();
    if (!symbol) {
      setHError("กรุณากรอกชื่อย่อหุ้นหรือกองทุน เช่น VOO, SCHD, SCBS&P500");
      return;
    }
    if (!name) {
      setHError("กรุณากรอกชื่อเต็มหรือคำอธิบายสินทรัพย์");
      return;
    }

    const targetPct = Number(hTargetPct);
    if (!Number.isFinite(targetPct) || targetPct < 0 || targetPct > 100) {
      setHError("สัดส่วนเป้าหมายต้องอยู่ระหว่าง 0 ถึง 100%");
      return;
    }

    const expectedRet = Number(hExpectedReturn);
    if (!Number.isFinite(expectedRet) || expectedRet < 0 || expectedRet > 50) {
      setHError("ผลตอบแทนคาดหวังเฉลี่ยต้องอยู่ระหว่าง 0 ถึง 50% ต่อปี");
      return;
    }

    const cleanedUnits = hUnits.replace(/,/g, "").trim();
    if (cleanedUnits && !/^\d+(\.\d{1,6})?$/.test(cleanedUnits)) {
      setHError("จำนวนหน่วยต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 6 ตำแหน่ง");
      return;
    }

    const payload: InvestmentHoldingFormInput = {
      symbol,
      name,
      assetType: hAssetType,
      targetAllocationPct: Number(targetPct.toFixed(1)),
      expectedAnnualReturnPct: Number(expectedRet.toFixed(2)),
      investedCost: parseSafeNonNegative(hInvestedCost, "0.00"),
      currentValue: parseSafeNonNegative(hCurrentValue, "0.00"),
      dividendsReceived: parseSafeNonNegative(hDividends, "0.00"),
      units: cleanedUnits ? toDecimal(cleanedUnits).toFixed(6) : null,
      currency: hCurrency,
      broker: hBroker.trim() || null,
      note: hNote.trim() || null,
      color: hColor,
    };

    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onUpsertHolding(
          payload,
          editingHolding?.id
        );
        if (!res.ok || !res.data) {
          setHError(res.error ?? "ไม่สามารถบันทึกข้อมูลสินทรัพย์ได้");
          return;
        }
        const saved = res.data;
        setHoldings((prev) =>
          editingHolding
            ? prev.map((item) => (item.id === editingHolding.id ? saved : item))
            : [...prev, saved]
        );
        setHoldingDialogOpen(false);
        toast.success(
          editingHolding
            ? `อัปเดต ${saved.symbol} เรียบร้อยแล้ว`
            : `เพิ่ม ${saved.symbol} เข้าพอร์ตแล้ว`
        );
      } finally {
        setIsMutating(false);
      }
      return;
    }

    const nextItem: InvestmentHoldingDTO = {
      id: editingHolding?.id ?? crypto.randomUUID(),
      ...payload,
      broker: payload.broker ?? null,
      note: payload.note ?? null,
      color: payload.color ?? HOLDING_COLOR_PRESETS[0],
    };

    setHoldings((prev) =>
      editingHolding
        ? prev.map((item) => (item.id === editingHolding.id ? nextItem : item))
        : [...prev, nextItem]
    );
    setHoldingDialogOpen(false);
    setNotice(
      editingHolding
        ? `อัปเดตข้อมูล ${nextItem.symbol} เรียบร้อยแล้ว`
        : `เพิ่ม ${nextItem.symbol} เข้าพอร์ตจำลองเรียบร้อยแล้ว`
    );
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

  function openAddSnapshot() {
    setSMonthKey(currentMonthKey);
    setSInvestedCost(
      portfolio.hasRealTrackingData
        ? portfolio.totalInvestedCost
        : settings.startingPrincipal
    );
    setSMarketValue(
      portfolio.hasRealTrackingData
        ? portfolio.totalCurrentValue
        : settings.startingPrincipal
    );
    setSDividends("0.00");
    setSNote("");
    setSError(null);
    setSnapshotDialogOpen(true);
  }

  async function handleSnapshotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSError(null);
    if (!/^\d{4}-\d{2}$/.test(sMonthKey)) {
      setSError("กรุณาเลือกเดือนให้ถูกต้อง (YYYY-MM)");
      return;
    }
    const cost = parseSafeNonNegative(sInvestedCost, "0.00");
    const val = parseSafeNonNegative(sMarketValue, "0.00");
    const div = parseSafeNonNegative(sDividends, "0.00");
    const snapInput: InvestmentSnapshotFormInput = {
      monthKey: sMonthKey,
      investedCost: cost,
      marketValue: val,
      dividends: div,
      note: sNote.trim() || null,
    };

    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onUpsertSnapshot(snapInput);
        if (!res.ok || !res.data) {
          setSError(res.error ?? "ไม่สามารถบันทึกยอดพอร์ตประจำเดือนได้");
          return;
        }
        const saved = res.data;
        setSnapshots((prev) => [
          saved,
          ...prev.filter((s) => s.monthKey !== saved.monthKey),
        ]);
        setSnapshotDialogOpen(false);
        toast.success(
          `บันทึกยอดพอร์ต ${formatMonthKeyThai(saved.monthKey)} แล้ว`
        );
      } finally {
        setIsMutating(false);
      }
      return;
    }

    const nextSnap: InvestmentSnapshotDTO = {
      id: crypto.randomUUID(),
      ...snapInput,
      note: snapInput.note ?? null,
    };

    setSnapshots((prev) => {
      const filtered = prev.filter((s) => s.monthKey !== sMonthKey);
      return [nextSnap, ...filtered];
    });
    setSnapshotDialogOpen(false);
    setNotice(
      `บันทึกยอดพอร์ตประจำเดือน ${formatMonthKeyThai(sMonthKey)} เรียบร้อยแล้ว`
    );
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

  function openRecordDca(holding: InvestmentHoldingDTO, suggestedAmount?: string) {
    setDcaHolding(holding);
    setDDate(todayIso);
    const defaultAmt =
      suggestedAmount && toDecimal(suggestedAmount).gt(0)
        ? suggestedAmount
        : "1000.00";
    setDAmountThb(defaultAmt);
    setDUnitsBought("");
    setDPricePerUnit("");
    setDFeeThb("0.00");
    setDNote("");
    setDError(null);

    const bankWallet =
      wallets.find((w) => w.type === "bank") ??
      wallets.find((w) => w.type !== "investment") ??
      wallets[0];
    const investWallet =
      wallets.find((w) => w.type === "investment") ??
      wallets.find((w) => w.id !== bankWallet?.id);
    const canTransfer = Boolean(
      isDbMode &&
        bankWallet &&
        investWallet &&
        bankWallet.id !== investWallet.id
    );
    setDSourceWalletId(bankWallet?.id ?? "");
    setDTargetWalletId(investWallet?.id ?? "");
    setDCreateTransfer(
      canTransfer && investWallet?.type === "investment"
    );
    setDcaDialogOpen(true);
  }

  async function handleDcaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dcaHolding) return;
    setDError(null);

    const cleanedAmt = dAmountThb.replace(/,/g, "").trim();
    const amtDec = toDecimal(parseSafeNonNegative(cleanedAmt, "0.00"));
    if (amtDec.lte(0)) {
      setDError("กรุณากรอกยอดเงินที่ซื้อ DCA มากกว่า 0 บาท");
      return;
    }
    const cleanedUnits = dUnitsBought.replace(/,/g, "").trim();
    if (cleanedUnits && !/^\d+(\.\d{1,6})?$/.test(cleanedUnits)) {
      setDError("จำนวนหน่วยต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 6 ตำแหน่ง");
      return;
    }
    const cleanedPrice = dPricePerUnit.replace(/,/g, "").trim();
    if (cleanedPrice && !/^\d+(\.\d{1,4})?$/.test(cleanedPrice)) {
      setDError("ราคาต่อหน่วยต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 4 ตำแหน่ง");
      return;
    }

    const input: RecordDcaExecutionInput = {
      holdingId: dcaHolding.id,
      executedDate: dDate,
      amountThb: amtDec.toFixed(2),
      unitsBought: cleanedUnits ? toDecimal(cleanedUnits).toFixed(6) : null,
      pricePerUnit: cleanedPrice ? toDecimal(cleanedPrice).toFixed(4) : null,
      feeThb: parseSafeNonNegative(dFeeThb, "0.00"),
      note: dNote.trim() || null,
      createTransferTransaction: isDbMode && dCreateTransfer,
      sourceWalletId: isDbMode && dCreateTransfer ? dSourceWalletId : null,
      targetInvestmentWalletId:
        isDbMode && dCreateTransfer ? dTargetWalletId : null,
    };

    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onRecordDca(input);
        if (!res.ok || !res.data) {
          setDError(res.error ?? "ไม่สามารถบันทึกการซื้อ DCA ได้");
          return;
        }
        setDcaLogs((prev) => [res.data!.log, ...prev]);
        setHoldings((prev) =>
          prev.map((h) =>
            h.id === res.data!.updatedHolding.id ? res.data!.updatedHolding : h
          )
        );
        setDcaDialogOpen(false);
        toast.success(
          `บันทึกซื้อ DCA ${dcaHolding.symbol} ฿${formatMoneyDisplay(amtDec)} แล้ว`,
          input.createTransferTransaction
            ? "โอนเงินเข้ากระเป๋าลงทุนและบวกต้นทุนพอร์ตให้อัตโนมัติ"
            : "อัปเดตต้นทุนสะสมในพอร์ตเรียบร้อยแล้ว"
        );
      } finally {
        setIsMutating(false);
      }
      return;
    }

    const math = applyDcaPurchaseMath({
      currentInvestedCost: dcaHolding.investedCost,
      currentValue: dcaHolding.currentValue,
      currentUnits: dcaHolding.units,
      amountThb: input.amountThb,
      unitsBought: input.unitsBought,
    });
    const localLog: InvestmentDcaLogDTO = {
      id: crypto.randomUUID(),
      holdingId: dcaHolding.id,
      holdingSymbol: dcaHolding.symbol,
      holdingName: dcaHolding.name,
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
        h.id === dcaHolding.id
          ? {
              ...h,
              investedCost: math.nextInvestedCost,
              currentValue: math.nextCurrentValue,
              units: math.nextUnits,
            }
          : h
      )
    );
    setDcaDialogOpen(false);
    toast.success(
      `บันทึกซื้อ DCA ${dcaHolding.symbol} ฿${formatMoneyDisplay(amtDec)} แล้ว`
    );
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
            prev.map((h) => (h.id === updated.id ? updated : h))
          );
        }
        toast.success(
          `ยกเลิกรายการ DCA ${log.holdingSymbol} แล้ว`,
          log.transactionId
            ? "ปรับต้นทุนพอร์ตและลบรายการโอนที่ผูกไว้คืนให้เรียบร้อย"
            : "ปรับยอดต้นทุนพอร์ตคืนให้เรียบร้อย"
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
      })
    );
  }

  function openRecordDividend(holding: InvestmentHoldingDTO) {
    setDivHolding(holding);
    setVDate(todayIso);
    setVAmountThb("");
    setVNote("");
    setVError(null);
    const defaultWallet =
      wallets.find((w) => w.type === "bank") ??
      wallets.find((w) => w.type === "investment") ??
      wallets[0];
    const defaultCategory =
      incomeCategories.find((c) => /ปันผล|ดอกเบี้ย/u.test(c.name)) ??
      incomeCategories[0];
    setVWalletId(defaultWallet?.id ?? "");
    setVCategoryId(defaultCategory?.id ?? "");
    setVCreateIncome(
      Boolean(isDbMode && defaultWallet && defaultCategory)
    );
    setDivDialogOpen(true);
  }

  async function handleDividendSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!divHolding) return;
    setVError(null);

    const amtDec = toDecimal(
      parseSafeNonNegative(vAmountThb.replace(/,/g, "").trim(), "0.00")
    );
    if (amtDec.lte(0)) {
      setVError("กรุณากรอกยอดเงินปันผลมากกว่า 0 บาท");
      return;
    }

    const input: RecordDividendInput = {
      holdingId: divHolding.id,
      receivedDate: vDate,
      amountThb: amtDec.toFixed(2),
      note: vNote.trim() || null,
      createIncomeTransaction: isDbMode && vCreateIncome,
      walletId: isDbMode && vCreateIncome ? vWalletId : null,
      categoryId: isDbMode && vCreateIncome ? vCategoryId : null,
    };

    if (isDbMode && dbHandlers) {
      setIsMutating(true);
      try {
        const res = await dbHandlers.onRecordDividend(input);
        if (!res.ok || !res.data) {
          setVError(res.error ?? "ไม่สามารถบันทึกเงินปันผลได้");
          return;
        }
        const updated = res.data.updatedHolding;
        setHoldings((prev) =>
          prev.map((h) => (h.id === updated.id ? updated : h))
        );
        setDivDialogOpen(false);
        toast.success(
          `บันทึกปันผล ${divHolding.symbol} +฿${formatMoneyDisplay(amtDec)} แล้ว`
        );
      } finally {
        setIsMutating(false);
      }
      return;
    }

    setHoldings((prev) =>
      prev.map((h) =>
        h.id === divHolding.id
          ? {
              ...h,
              dividendsReceived: toDecimal(h.dividendsReceived)
                .plus(amtDec)
                .toFixed(2),
            }
          : h
      )
    );
    setDivDialogOpen(false);
    toast.success(
      `บันทึกปันผล ${divHolding.symbol} +฿${formatMoneyDisplay(amtDec)} แล้ว`
    );
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
        `นำเข้า ${res.data.holdings.length} สินทรัพย์ และ ${res.data.snapshots.length} รายการย้อนหลังแล้ว`
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
          payload?.error ?? "ไม่สามารถเชื่อมต่อแหล่งข้อมูลราคาได้"
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
          })
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
          failInfo || "คำนวณมูลค่าพอร์ตเป็นเงินบาทล่าสุดเรียบร้อย"
        );
      } else {
        toast.warning(
          "ยังไม่มีรายการที่อัปเดตราคาได้",
          payload?.message ??
            "กรอกจำนวนหน่วย (Units > 0) ในหุ้น/ETF ที่มี Ticker มาตรฐาน เช่น VOO, QQQM, PTT.BK ก่อนนะครับ"
        );
      }
    } catch {
      toast.error(
        "เชื่อมต่อดึงราคาตลาดไม่สำเร็จ",
        "ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง"
      );
    } finally {
      setIsRefreshingPrices(false);
    }
  }

  const displayedPortfolioValue = portfolio.hasRealTrackingData
    ? portfolio.totalCurrentValue
    : settings.startingPrincipal;
  const displayedGainDec = toDecimal(portfolio.totalUnrealizedGain);
  const currentMonthlyDcaDec = toDecimal(settings.monthlyDca);
  const requiredDcaDec = toDecimal(projection.requiredMonthlyDcaForHorizon);
  const dcaShortfallDec = requiredDcaDec.minus(currentMonthlyDcaDec);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              การลงทุน &amp; แผน DCA
            </h1>
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-medium",
                isDbMode
                  ? "border-emerald-600/35 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300"
                  : "border-teal-600/30 bg-teal-600/10 text-teal-700 dark:text-teal-300"
              )}
            >
              {isDbMode ? (
                <span className="inline-flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  <span>
                    ซิงก์ PostgreSQL แล้ว
                    {settingsSaveState === "saving"
                      ? " · กำลังบันทึก..."
                      : settingsSaveState === "saved"
                        ? " · บันทึกแล้ว"
                        : ""}
                  </span>
                </span>
              ) : (
                "โหมดทดลอง • บันทึกในเบราว์เซอร์"
              )}
            </Badge>
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
                {pendingLocalImport.snapshots?.length ?? 0} ประวัติรายเดือน — นำเข้าสู่บัญชี PostgreSQL เพื่อซิงก์กับ iPhone/iPad ได้ในคลิกเดียว
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
              disabled={isMutating}
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
              : `ลองเพิ่มยอด DCA ต่อเดือน หรือปรับเป้าหมาย`}
          </CardContent>
        </Card>
      </div>

      {/* Simulator & Goal Settings Card */}
      <Card>
        <CardHeader className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-teal-600" />
              <span>ตัวจำลองแผนการลงทุน &amp; เป้าหมายพอร์ตระยะยาว</span>
            </CardTitle>
            <CardDescription className="mt-0.5">
              ปรับตัวเลขเป้าหมาย ยอด DCA และผลตอบแทนเฉลี่ยเพื่อดูกราฟทบต้นแบบเรียลไทม์
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSimulatorOpen((o) => !o)}
            className="w-full shrink-0 gap-1 sm:w-auto"
          >
            <span>{simulatorOpen ? "ซ่อนแผงตั้งค่า" : "ปรับตัวเลขจำลอง"}</span>
            {simulatorOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CardHeader>

        <SmoothExpand watchKey={simulatorOpen}>
          {simulatorOpen ? (
            <CardContent className="space-y-4 border-t pt-4">
              {/* Quick Preset Chips */}
              <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    เป้าหมายด่วน:
                  </span>
                  {GOAL_PRESETS.map((preset) => {
                    const active =
                      toDecimal(settings.targetGoalAmount).eq(preset.value);
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handleGoalChange(preset.value)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          active
                            ? "border-teal-700 bg-teal-700 text-white"
                            : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    ผลตอบแทนเฉลี่ย:
                  </span>
                  {RETURN_PRESETS.map((preset) => {
                    const active =
                      settings.expectedAnnualReturnPct === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => handleReturnChange(String(preset.value))}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          active
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  {holdings.length > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleReturnChange(
                          String(portfolio.weightedExpectedReturnPct)
                        )
                      }
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        settings.expectedAnnualReturnPct ===
                          portfolio.weightedExpectedReturnPct
                          ? "border-teal-700 bg-teal-700 text-white"
                          : "border-teal-600/30 bg-teal-600/10 text-teal-700 hover:bg-teal-600/15 dark:text-teal-300"
                      )}
                    >
                      ใช้เฉลี่ยจากพอร์ต ({portfolio.weightedExpectedReturnPct}%)
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Inputs Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-goal">เป้าหมายพอร์ต (บาท)</Label>
                  <Input
                    id="inv-goal"
                    inputMode="decimal"
                    value={goalInput}
                    onChange={(e) => handleGoalChange(e.target.value)}
                    placeholder="2000000"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <Label htmlFor="inv-principal">
                      เงินต้นตั้งต้น / พอร์ตปัจจุบัน (บาท)
                    </Label>
                    {toDecimal(linkedInvestmentWalletTotal).gt(0) ? (
                      <button
                        type="button"
                        onClick={() =>
                          handlePrincipalChange(linkedInvestmentWalletTotal)
                        }
                        className="text-[11px] font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-300"
                      >
                        ดึงจากกระเป๋าหุ้น (฿
                        {formatMoneyDisplay(linkedInvestmentWalletTotal)})
                      </button>
                    ) : portfolio.hasRealTrackingData ? (
                      <button
                        type="button"
                        onClick={() =>
                          handlePrincipalChange(portfolio.totalCurrentValue)
                        }
                        className="text-[11px] font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-300"
                      >
                        ใช้ยอดพอร์ตจริง (฿
                        {formatMoneyDisplay(portfolio.totalCurrentValue)})
                      </button>
                    ) : null}
                  </div>
                  <Input
                    id="inv-principal"
                    inputMode="decimal"
                    value={principalInput}
                    onChange={(e) => handlePrincipalChange(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <Label htmlFor="inv-dca">ยอด DCA ต่อเดือน (บาท)</Label>
                    {toDecimal(linkedPlanDcaMonthly).gt(0) ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleMonthlyDcaChange(linkedPlanDcaMonthly)
                        }
                        className="text-[11px] font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800 dark:text-teal-300"
                      >
                        ดึงจากแผนเงินเดือน (฿
                        {formatMoneyDisplay(linkedPlanDcaMonthly)})
                      </button>
                    ) : null}
                  </div>
                  <Input
                    id="inv-dca"
                    inputMode="decimal"
                    value={monthlyDcaInput}
                    onChange={(e) => handleMonthlyDcaChange(e.target.value)}
                    placeholder="3000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-return">
                    ผลตอบแทนเฉลี่ยคาดหวัง (% ต่อปี)
                  </Label>
                  <Input
                    id="inv-return"
                    inputMode="decimal"
                    value={returnInput}
                    onChange={(e) => handleReturnChange(e.target.value)}
                    placeholder="8"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="inv-horizon">ระยะเวลาลงทุน (ปี)</Label>
                    <div className="flex items-center gap-1">
                      {HORIZON_PRESETS.map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => handleHorizonChange(String(yr))}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                            settings.horizonYears === yr
                              ? "bg-teal-700 text-white"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {yr}ปี
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    id="inv-horizon"
                    inputMode="numeric"
                    value={horizonInput}
                    onChange={(e) => handleHorizonChange(e.target.value)}
                    placeholder="15"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-stepup">
                    เพิ่มยอด DCA ต่อปี (% — เมื่อเงินเดือนขึ้น)
                  </Label>
                  <Input
                    id="inv-stepup"
                    inputMode="decimal"
                    value={stepUpInput}
                    onChange={(e) => handleStepUpChange(e.target.value)}
                    placeholder="0 (เช่น 5 หรือ 10)"
                  />
                </div>
              </div>

              {/* Insight Box */}
              <div className="grid gap-3 rounded-xl border bg-muted/30 p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground">
                    มูลค่าพอร์ตเมื่อครบ {settings.horizonYears} ปี (พ.ศ.{" "}
                    {currentGregorianYear + 543 + settings.horizonYears})
                  </p>
                  <p className="text-base font-bold text-emerald-600 tabular-nums">
                    ฿{formatMoneyDisplay(projection.finalValue)}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    เงินต้นสะสม ฿{formatMoneyDisplay(projection.finalContributed)} +
                    ผลตอบแทนทบต้น{" "}
                    <strong className="text-emerald-600">
                      +฿{formatMoneyDisplay(projection.finalGain)} (+
                      {projection.finalGainPct}%)
                    </strong>
                  </p>
                </div>

                <div className="space-y-0.5">
                  <p className="text-muted-foreground">
                    ถ้าอยากถึงเป้า ฿{formatMoneyDisplay(settings.targetGoalAmount)}{" "}
                    ใน {settings.horizonYears} ปี
                  </p>
                  <p className="text-base font-bold text-teal-700 tabular-nums dark:text-teal-300">
                    ต้อง DCA ~฿
                    {formatMoneyDisplay(projection.requiredMonthlyDcaForHorizon)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      / เดือน
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {dcaShortfallDec.gt(0)
                      ? `ยังขาดอีก ฿${formatMoneyDisplay(dcaShortfallDec)}/ด. จากแผนตอนนี้`
                      : "ยอด DCA ตอนนี้เพียงพอถึงเป้าภายในระยะเวลาที่ตั้งไว้แล้ว ✓"}
                  </p>
                </div>

                <div className="flex flex-col justify-between gap-2 sm:col-span-2 lg:col-span-1">
                  <p className="text-muted-foreground">
                    ความคืบหน้าสู่เป้า ฿
                    {formatMoneyDisplay(settings.targetGoalAmount)}
                  </p>
                  <div className="space-y-1">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="animate-mf-progress h-full rounded-full bg-teal-600"
                        style={{ width: `${projection.goalProgressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] tabular-nums">
                      <span className="text-muted-foreground">
                        พอร์ตปัจจุบัน ฿
                        {formatMoneyDisplay(displayedPortfolioValue)}
                      </span>
                      <span className="font-semibold text-teal-700 dark:text-teal-300">
                        {projection.goalProgressPct}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          ) : null}
        </SmoothExpand>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineChart className="h-4 w-4 text-emerald-600" />
              <span>
                จำลองการเติบโตแบบทบต้น ({settings.horizonYears} ปี • เฉลี่ย{" "}
                {settings.expectedAnnualReturnPct}%/ปี)
              </span>
            </CardTitle>
            <CardDescription>
              เปรียบเทียบเงินต้นที่ใส่สะสม (สีฟ้า) กับมูลค่าพอร์ตเมื่อรวมผลตอบแทนทบต้น (สีเขียว)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvestmentProjectionChart
              points={projection.points}
              targetGoal={Number(settings.targetGoalAmount)}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="h-4 w-4 text-teal-600" />
              <span>สัดส่วนแผน DCA แยกรายสินทรัพย์</span>
            </CardTitle>
            <CardDescription>
              แบ่งยอด ฿{formatMoneyDisplay(settings.monthlyDca)}/เดือน ตามสัดส่วนที่ตั้งใจลงทุน
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {holdings.length > 0 &&
            Math.abs(portfolio.totalTargetAllocationPct - 100) > 0.1 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  สัดส่วนเป้าหมายรวมตอนนี้คือ{" "}
                  <strong>{portfolio.totalTargetAllocationPct}%</strong>{" "}
                  (แนะนำปรับให้รวมกันเท่ากับ 100%)
                </span>
              </div>
            ) : null}

            <InvestmentAllocationDonutChart
              holdings={portfolio.holdings}
              monthlyDca={settings.monthlyDca}
            />
          </CardContent>
        </Card>
      </div>

      {/* Monthly DCA Checklist & Execution Log (Phase 9B) */}
      {holdings.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
                <span>
                  เช็กลิสต์ DCA เดือน {formatMonthKeyThai(currentMonthKey)}
                </span>
              </CardTitle>
              <CardDescription>
                ซื้อแล้ว {monthlyChecklist.completedCount}/
                {monthlyChecklist.totalCount} รายการ • ยอดซื้อรวม ฿
                {formatMoneyDisplay(monthlyChecklist.totalBoughtThb)} / แผน ฿
                {formatMoneyDisplay(monthlyChecklist.totalPlannedThb)}
              </CardDescription>
            </div>
            {dcaLogs.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDcaLogsExpanded((prev) => !prev)}
                className="w-full shrink-0 gap-1.5 sm:w-auto"
              >
                <History className="h-3.5 w-3.5" />
                <span>ประวัติซื้อ DCA ({dcaLogs.length})</span>
                {dcaLogsExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {monthlyChecklist.items.map((item) => {
                const targetHolding = holdings.find(
                  (h) => h.id === item.holdingId
                );
                if (!targetHolding) return null;

                return (
                  <div
                    key={item.holdingId}
                    className={cn(
                      "flex items-center justify-between gap-2.5 rounded-xl border p-3 text-xs",
                      item.status === "done"
                        ? "border-emerald-600/35 bg-emerald-600/5"
                        : item.status === "partial"
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "bg-background"
                    )}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-bold">{item.symbol}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            item.status === "done"
                              ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-300"
                              : item.status === "partial"
                                ? "border-amber-500/40 text-amber-700 dark:text-amber-300"
                                : "text-muted-foreground"
                          )}
                        >
                          {item.status === "done"
                            ? "ครบแผนแล้ว"
                            : item.status === "partial"
                              ? `ซื้อแล้ว ฿${formatMoneyDisplay(item.boughtAmountThb)}`
                              : "ยังไม่ซื้อ"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        แผนเดือนนี้ ฿{formatMoneyDisplay(item.plannedAmountThb)}
                        {item.status !== "done" &&
                        toDecimal(item.remainingAmountThb).gt(0)
                          ? ` • เหลือ ฿${formatMoneyDisplay(item.remainingAmountThb)}`
                          : ""}
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant={item.status === "done" ? "outline" : "default"}
                      disabled={isMutating}
                      onClick={() =>
                        openRecordDca(
                          targetHolding,
                          toDecimal(item.remainingAmountThb).gt(0)
                            ? item.remainingAmountThb
                            : item.plannedAmountThb
                        )
                      }
                      className={cn(
                        "h-8 shrink-0 gap-1 px-2.5 text-xs",
                        item.status !== "done" &&
                          "bg-teal-700 text-white hover:bg-teal-800"
                      )}
                    >
                      <Plus className="h-3 w-3" />
                      <span>
                        {item.status === "done" ? "ซื้อเพิ่ม" : "บันทึกซื้อ"}
                      </span>
                    </Button>
                  </div>
                );
              })}
            </div>

            <SmoothExpand watchKey={dcaLogsExpanded ? dcaLogs.length : 0}>
              {dcaLogsExpanded && dcaLogs.length > 0 ? (
                <div className="space-y-1.5 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    ประวัติการบันทึกซื้อ DCA ล่าสุด
                  </p>
                  <div className="space-y-1.5">
                    {dcaLogs.slice(0, 15).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold">
                              {log.holdingSymbol}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatIsoDateForDisplay(log.executedDate)}
                            </span>
                            {log.transactionId ? (
                              <Badge variant="outline" className="text-[10px]">
                                ผูกโอนบัญชีแล้ว
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                            ฿{formatMoneyDisplay(log.amountThb)}
                            {log.unitsBought
                              ? ` • ${Number(log.unitsBought)} หน่วย`
                              : ""}
                            {log.note ? ` • ${log.note}` : ""}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={isMutating}
                          onClick={() => handleDeleteDcaLog(log)}
                          aria-label={`ลบประวัติ DCA ${log.holdingSymbol}`}
                          title="ยกเลิกและปรับยอดคืน"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </SmoothExpand>
          </CardContent>
        </Card>
      ) : null}

      {/* Holdings & Future Real-Tracking Section */}
      <Card>
        <CardHeader className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-teal-600" />
              <span>หุ้น / กองทุนในพอร์ต &amp; ติดตามผลตอบแทนจริง</span>
            </CardTitle>
            <CardDescription>
              ตั้งสัดส่วน DCA รายเดือน กดบันทึกซื้อจริง/ปันผล หรืออัปเดตราคาตลาดล่าสุดสำหรับหุ้น/ETF ที่ระบุจำนวนหน่วย
            </CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {isDbMode && holdings.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRefreshingPrices || isMutating}
                onClick={handleRefreshPrices}
                className="flex-1 gap-1.5 sm:flex-none"
              >
                {isRefreshingPrices ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-teal-600" />
                )}
                <span>อัปเดตราคาตลาด</span>
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={isMutating}
              onClick={openAddHolding}
              className="flex-1 gap-1 bg-teal-700 text-white hover:bg-teal-800 sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              <span>เพิ่มหุ้น / กองทุน</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick-Add Popular Presets for Beginners */}
          {POPULAR_DCA_PRESETS.some(
            (p) => !existingSymbolSet.has(p.symbol.toUpperCase())
          ) ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed bg-muted/25 p-3">
              <span className="text-xs text-muted-foreground">
                เพิ่มตัวเลือกยอดนิยมสำหรับมือใหม่ DCA:
              </span>
              {POPULAR_DCA_PRESETS.filter(
                (p) => !existingSymbolSet.has(p.symbol.toUpperCase())
              ).map((preset) => (
                <button
                  key={preset.symbol}
                  type="button"
                  onClick={() => handleQuickAddPreset(preset)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-teal-600/50 hover:bg-teal-600/10"
                >
                  <Plus className="h-3 w-3 text-teal-600" />
                  <span>{preset.symbol}</span>
                  <span className="text-[10px] text-muted-foreground">
                    (~{preset.expectedAnnualReturnPct}%)
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {portfolio.holdings.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              ยังไม่มีรายการหุ้นหรือกองทุน กดปุ่ม &ldquo;+ เพิ่มหุ้น / กองทุน&rdquo; หรือเลือกจากตัวเลือกยอดนิยมด้านบนได้เลย
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {portfolio.holdings.map((item) => {
                const assetMeta = INVESTMENT_ASSET_TYPE_META[item.assetType];
                const gainDec = toDecimal(item.unrealizedGain);
                const hasRealData =
                  toDecimal(item.investedCost).gt(0) ||
                  toDecimal(item.currentValue).gt(0) ||
                  toDecimal(item.dividendsReceived).gt(0);

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 rounded-xl border bg-background p-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-bold tracking-tight">
                              {item.symbol}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {assetMeta.shortLabel}
                            </Badge>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.name}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 max-lg:gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:size-9"
                            aria-label={`แก้ไข ${item.symbol}`}
                            title="แก้ไข / กรอกยอดลงทุนจริง"
                            onClick={() => openEditHolding(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:size-9 text-destructive hover:text-destructive"
                            aria-label={`ลบ ${item.symbol}`}
                            title="ลบออก"
                            onClick={() => handleDeleteHolding(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Monthly DCA Plan Split */}
                      <div className="flex items-baseline justify-between border-t pt-2">
                        <div className="text-xs text-muted-foreground tabular-nums">
                          สัดส่วน{" "}
                          <strong className="text-foreground">
                            {item.targetAllocationPct}%
                          </strong>{" "}
                          • คาดหวัง{" "}
                          <strong className="text-emerald-600">
                            {item.expectedAnnualReturnPct}%/ปี
                          </strong>
                        </div>
                        <span className="text-base font-bold text-teal-700 tabular-nums dark:text-teal-300">
                          ฿{formatMoneyDisplay(item.monthlyDcaAmount)}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            /ด.
                          </span>
                        </span>
                      </div>

                      {/* Real Portfolio Tracking Box (for future manual entry) */}
                      <div className="rounded-lg bg-muted/40 p-2.5 text-xs">
                        {hasRealData ? (
                          <div className="space-y-1 tabular-nums">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">
                                มูลค่าพอร์ตจริง
                              </span>
                              <span className="font-semibold text-foreground">
                                ฿{formatMoneyDisplay(item.currentValue)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">
                                เงินต้นที่ลงไป
                              </span>
                              <span>฿{formatMoneyDisplay(item.investedCost)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 border-t pt-1">
                              <span className="text-muted-foreground">
                                กำไร/ขาดทุน
                              </span>
                              <span
                                className={cn(
                                  "font-semibold",
                                  gainDec.gte(0)
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                )}
                              >
                                {gainDec.gte(0) ? "+" : "-"}฿
                                {formatMoneyDisplay(gainDec.abs())} (
                                {gainDec.gte(0) ? "+" : ""}
                                {item.unrealizedGainPct}%)
                              </span>
                            </div>
                            {toDecimal(item.dividendsReceived).gt(0) ? (
                              <div className="flex items-center justify-between gap-2 text-[11px] text-teal-700 dark:text-teal-300">
                                <span>ปันผลรับสะสม</span>
                                <span>
                                  +฿{formatMoneyDisplay(item.dividendsReceived)}
                                </span>
                              </div>
                            ) : null}
                            {item.units && toDecimal(item.units).gt(0) ? (
                              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                <span>จำนวนหน่วยถือครอง</span>
                                <span>
                                  {Number(item.units)} หน่วย ({item.currency ?? "THB"})
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              openRecordDca(item, item.monthlyDcaAmount)
                            }
                            className="flex w-full items-center justify-between gap-2 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <span>
                              ยังไม่เริ่มซื้อจริง — คลิกเพื่อบันทึกซื้อ DCA ไม้แรก
                            </span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                          </button>
                        )}
                      </div>

                      {/* Quick DCA & Dividend Action Bar */}
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isMutating}
                          onClick={() =>
                            openRecordDca(item, item.monthlyDcaAmount)
                          }
                          className="h-8 gap-1 text-[11px]"
                        >
                          <Plus className="h-3 w-3 text-teal-600" />
                          <span>ซื้อ DCA</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isMutating}
                          onClick={() => openRecordDividend(item)}
                          className="h-8 gap-1 text-[11px]"
                        >
                          <Coins className="h-3 w-3 text-amber-600" />
                          <span>บันทึกปันผล</span>
                        </Button>
                      </div>
                    </div>

                    {item.broker || item.note ? (
                      <div className="border-t pt-2 text-[11px] text-muted-foreground">
                        {item.broker ? (
                          <span className="font-medium text-foreground">
                            {item.broker}
                          </span>
                        ) : null}
                        {item.broker && item.note ? " • " : ""}
                        {item.note ?? ""}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Portfolio Value Log (For Future Self-Entry) */}
      <Card>
        <CardHeader className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-teal-600" />
              <span>สมุดบันทึกยอดพอร์ตรายเดือน (สำหรับอัปเดตเองในอนาคต)</span>
            </CardTitle>
            <CardDescription>
              เมื่อเริ่มลงทุนจริง แนะนำบันทึกเดือนละ 1 ครั้งจากหน้าแอปโบรคเกอร์ เพื่อติดตามเงินต้นเทียบกับมูลค่าจริงและปันผลสะสม
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openAddSnapshot}
            className="w-full shrink-0 gap-1.5 sm:w-auto"
          >
            <Plus className="h-4 w-4 text-teal-600" />
            <span>บันทึกยอดพอร์ตเดือนนี้</span>
          </Button>
        </CardHeader>

        <CardContent>
          {sortedSnapshots.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-8 text-center text-xs text-muted-foreground sm:text-sm">
              ยังไม่มีประวัติการบันทึกยอดพอร์ตรายเดือน — เมื่อเริ่ม DCA จริงแล้วสามารถกดปุ่ม{" "}
              <strong className="text-foreground">
                &ldquo;บันทึกยอดพอร์ตเดือนนี้&rdquo;
              </strong>{" "}
              เพื่อจดสรุปผลการลงทุนของแต่ละเดือนได้ทันที
            </div>
          ) : (
            <>
              {/* Mobile & iPad Portrait Cards */}
              <div className="space-y-2.5 lg:hidden">
                {sortedSnapshots.map((snap) => {
                  const cost = toDecimal(snap.investedCost);
                  const val = toDecimal(snap.marketValue);
                  const pnl = val.minus(cost);
                  const pnlPct = cost.gt(0)
                    ? pnl.div(cost).times(100).toDecimalPlaces(2).toNumber()
                    : 0;
                  return (
                    <div
                      key={snap.id}
                      className="rounded-xl border bg-background p-3.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm">
                          {formatMonthKeyThai(snap.monthKey)}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              handlePrincipalChange(snap.marketValue);
                              setNotice(
                                `นำมูลค่าพอร์ตเดือน ${formatMonthKeyThai(snap.monthKey)} (฿${formatMoneyDisplay(snap.marketValue)}) ไปใส่ในตัวจำลองด้านบนแล้ว`
                              );
                            }}
                            className="h-8 gap-1 text-[11px] text-teal-700 dark:text-teal-300"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>ใช้ในจำลอง</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลบบันทึกเดือนนี้"
                            className="size-9 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSnapshot(snap.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-2 tabular-nums">
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            เงินต้นสะสม
                          </p>
                          <p className="font-medium">
                            ฿{formatMoneyDisplay(cost)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            มูลค่าจริง
                          </p>
                          <p className="font-semibold">
                            ฿{formatMoneyDisplay(val)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            กำไร/ขาดทุน
                          </p>
                          <p
                            className={cn(
                              "font-semibold",
                              pnl.gte(0) ? "text-emerald-600" : "text-rose-600"
                            )}
                          >
                            {pnl.gte(0) ? "+" : "-"}฿
                            {formatMoneyDisplay(pnl.abs())} ({pnlPct}%)
                          </p>
                        </div>
                      </div>
                      {snap.note ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          หมายเหตุ: {snap.note}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Desktop & iPad Landscape Table */}
              <div className="hidden overflow-hidden rounded-xl border lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เดือน</TableHead>
                      <TableHead className="text-right">เงินต้นสะสม</TableHead>
                      <TableHead className="text-right">มูลค่าพอร์ตจริง</TableHead>
                      <TableHead className="text-right">กำไร / ขาดทุน</TableHead>
                      <TableHead className="text-right">ปันผลเดือนนั้น</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                      <TableHead className="w-36 text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedSnapshots.map((snap) => {
                      const cost = toDecimal(snap.investedCost);
                      const val = toDecimal(snap.marketValue);
                      const pnl = val.minus(cost);
                      const pnlPct = cost.gt(0)
                        ? pnl.div(cost).times(100).toDecimalPlaces(2).toNumber()
                        : 0;
                      return (
                        <TableRow key={snap.id}>
                          <TableCell className="font-medium">
                            {formatMonthKeyThai(snap.monthKey)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ฿{formatMoneyDisplay(cost)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            ฿{formatMoneyDisplay(val)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums",
                              pnl.gte(0) ? "text-emerald-600" : "text-rose-600"
                            )}
                          >
                            {pnl.gte(0) ? "+" : "-"}฿
                            {formatMoneyDisplay(pnl.abs())} (
                            {pnl.gte(0) ? "+" : ""}
                            {pnlPct}%)
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-teal-700 dark:text-teal-300">
                            ฿{formatMoneyDisplay(snap.dividends)}
                          </TableCell>
                          <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                            {snap.note ?? "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-teal-700 dark:text-teal-300"
                                onClick={() => {
                                  handlePrincipalChange(snap.marketValue);
                                  setNotice(
                                    `นำมูลค่าพอร์ตเดือน ${formatMonthKeyThai(snap.monthKey)} ไปใส่ในตัวจำลองด้านบนแล้ว`
                                  );
                                }}
                              >
                                ใช้ในจำลอง
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="ลบบันทึกเดือนนี้"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteSnapshot(snap.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Holding Modal */}
      <Dialog open={holdingDialogOpen} onOpenChange={setHoldingDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingHolding
                ? `แก้ไขสินทรัพย์ (${editingHolding.symbol})`
                : "เพิ่มหุ้น / กองทุนในแผนการลงทุน"}
            </DialogTitle>
            <DialogDescription>
              ระบุหุ้นหรือกองทุนที่สนใจพร้อมสัดส่วน DCA และสามารถมากรอกยอดลงทุนจริงในอนาคตได้ทุกเมื่อ
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleHoldingSubmit} className="space-y-4">
            {hError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {hError}
              </p>
            ) : null}

            {/* Part 1: Planning Fields */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                1. ข้อมูลแผน DCA (ใช้คำนวณสัดส่วนและค่าเฉลี่ย)
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="h-symbol">ชื่อย่อ / Ticker</Label>
                  <Input
                    id="h-symbol"
                    value={hSymbol}
                    onChange={(e) => setHSymbol(e.target.value)}
                    placeholder="เช่น VOO, SCHD, SCBS&P500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-type">ประเภทสินทรัพย์</Label>
                  <AppSelect
                    id="h-type"
                    value={hAssetType}
                    onValueChange={(val) =>
                      setHAssetType(val as InvestmentAssetType)
                    }
                    options={[
                      {
                        value: "etf",
                        label: "ETF / ดัชนีต่างประเทศ",
                        dotColor: "#0f766e",
                      },
                      {
                        value: "mutual_fund",
                        label: "กองทุนรวม",
                        dotColor: "#10b981",
                      },
                      {
                        value: "stock",
                        label: "หุ้นรายตัว (ไทย / ต่างประเทศ)",
                        dotColor: "#3b82f6",
                      },
                      {
                        value: "gold_bond",
                        label: "ทองคำ / ตราสารหนี้",
                        dotColor: "#f59e0b",
                      },
                      {
                        value: "other",
                        label: "สินทรัพย์ทางเลือกอื่นๆ",
                        dotColor: "#8b5cf6",
                      },
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="h-name">ชื่อเต็ม / คำอธิบาย</Label>
                <Input
                  id="h-name"
                  value={hName}
                  onChange={(e) => setHName(e.target.value)}
                  placeholder="เช่น Vanguard S&P 500 ETF"
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="h-pct">สัดส่วนเป้าหมายในพอร์ต (%)</Label>
                  <Input
                    id="h-pct"
                    inputMode="decimal"
                    value={hTargetPct}
                    onChange={(e) => setHTargetPct(e.target.value)}
                    placeholder="เช่น 60"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="h-return">
                    ผลตอบแทนคาดหวังเฉลี่ย (% ต่อปี)
                  </Label>
                  <Input
                    id="h-return"
                    inputMode="decimal"
                    value={hExpectedReturn}
                    onChange={(e) => setHExpectedReturn(e.target.value)}
                    placeholder="เช่น 8.5"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Part 2: Future Manual Tracking Fields */}
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  2. ช่องกรอกยอดจริง (สำหรับอนาคตเมื่อเริ่มซื้อจริง — ใส่ 0 ไว้ก่อนได้)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ดูตัวเลขจากแอปโบรคเกอร์มากรอกอัปเดตเมื่อไหร่ก็ได้ ระบบจะคำนวณกำไร/ขาดทุนให้ทันที
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="h-cost" className="text-xs">
                    เงินต้นที่ลงไปแล้ว (บาท)
                  </Label>
                  <Input
                    id="h-cost"
                    inputMode="decimal"
                    value={hInvestedCost}
                    onChange={(e) => setHInvestedCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="h-val" className="text-xs">
                    มูลค่าพอร์ตจริงตอนนี้ (บาท)
                  </Label>
                  <Input
                    id="h-val"
                    inputMode="decimal"
                    value={hCurrentValue}
                    onChange={(e) => setHCurrentValue(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="h-div" className="text-xs">
                    ปันผลรับสะสม (บาท)
                  </Label>
                  <Input
                    id="h-div"
                    inputMode="decimal"
                    value={hDividends}
                    onChange={(e) => setHDividends(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="h-units" className="text-xs">
                    จำนวนหน่วย / หุ้นที่ถือ (ไม่บังคับ — ใช้ดึงราคาตลาด)
                  </Label>
                  <Input
                    id="h-units"
                    inputMode="decimal"
                    value={hUnits}
                    onChange={(e) => setHUnits(e.target.value)}
                    placeholder="เช่น 2.5"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="h-currency" className="text-xs">
                    สกุลเงินราคาตลาด
                  </Label>
                  <AppSelect
                    id="h-currency"
                    value={hCurrency}
                    onValueChange={(val) =>
                      setHCurrency(val as InvestmentCurrency)
                    }
                    options={[
                      { value: "THB", label: "THB (บาท — หุ้นไทย/กองทุนไทย)" },
                      { value: "USD", label: "USD (ดอลลาร์ — ETF/หุ้นอเมริกา)" },
                    ]}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="h-broker" className="text-xs">
                    แอป / โบรคเกอร์ที่ใช้ (ไม่บังคับ)
                  </Label>
                  <Input
                    id="h-broker"
                    value={hBroker}
                    onChange={(e) => setHBroker(e.target.value)}
                    placeholder="เช่น Dime, InnovestX, Finnomena"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="h-note" className="text-xs">
                    หมายเหตุ / แผนการซื้อ (ไม่บังคับ)
                  </Label>
                  <Input
                    id="h-note"
                    value={hNote}
                    onChange={(e) => setHNote(e.target.value)}
                    placeholder="เช่น ซื้อทุกวันที่ 25"
                  />
                </div>
              </div>
            </div>

            {/* Color Swatches */}
            <div className="space-y-1.5">
              <Label>สีในกราฟ</Label>
              <div className="flex flex-wrap gap-2">
                {HOLDING_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`เลือกสี ${color}`}
                    onClick={() => setHColor(color)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform max-lg:h-9 max-lg:w-9",
                      hColor === color
                        ? "scale-110 border-foreground"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setHoldingDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                className="bg-teal-700 text-white hover:bg-teal-800"
              >
                {editingHolding ? "บันทึกการแก้ไข" : "เพิ่มเข้าพอร์ต"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Monthly Portfolio Snapshot Modal */}
      <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึกยอดพอร์ตประจำเดือน</DialogTitle>
            <DialogDescription>
              กรอกยอดรวมจากแอปโบรคเกอร์เดือนละ 1 ครั้ง เพื่อเก็บประวัติการเติบโตจริงของพอร์ต
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSnapshotSubmit} className="space-y-4">
            {sError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {sError}
              </p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="s-month">เดือนที่บันทึก</Label>
              <Input
                id="s-month"
                type="month"
                value={sMonthKey}
                onChange={(e) => setSMonthKey(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-cost">เงินต้นที่ลงสะสมรวม (บาท)</Label>
                <Input
                  id="s-cost"
                  inputMode="decimal"
                  value={sInvestedCost}
                  onChange={(e) => setSInvestedCost(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-value">มูลค่าพอร์ตจริงตอนนี้ (บาท)</Label>
                <Input
                  id="s-value"
                  inputMode="decimal"
                  value={sMarketValue}
                  onChange={(e) => setSMarketValue(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-div">ปันผลที่ได้รับเดือนนี้ (บาท)</Label>
                <Input
                  id="s-div"
                  inputMode="decimal"
                  value={sDividends}
                  onChange={(e) => setSDividends(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-note">หมายเหตุ (ไม่บังคับ)</Label>
                <Input
                  id="s-note"
                  value={sNote}
                  onChange={(e) => setSNote(e.target.value)}
                  placeholder="เช่น ซื้อ VOO เพิ่ม 1 ไม้"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSnapshotDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={isMutating}
                className="bg-teal-700 text-white hover:bg-teal-800"
              >
                บันทึกยอดเดือนนี้
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record DCA Execution Dialog (Phase 9B) */}
      <Dialog open={dcaDialogOpen} onOpenChange={setDcaDialogOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              บันทึกซื้อ DCA {dcaHolding ? `• ${dcaHolding.symbol}` : ""}
            </DialogTitle>
            <DialogDescription>
              {dcaHolding?.name ?? "กรอกยอดเงินที่ซื้อจริงเพื่ออัปเดตต้นทุนสะสม"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDcaSubmit} className="space-y-4">
            {dError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {dError}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-date">วันที่ซื้อ (เวลาไทย)</Label>
                <Input
                  id="d-date"
                  type="date"
                  value={dDate}
                  onChange={(e) => setDDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-amount">ยอดเงินที่ซื้อจริง (บาท)</Label>
                <Input
                  id="d-amount"
                  inputMode="decimal"
                  value={dAmountThb}
                  onChange={(e) => setDAmountThb(e.target.value)}
                  placeholder="1000.00"
                  required
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="d-units" className="text-xs">
                  จำนวนหน่วย (ไม่บังคับ)
                </Label>
                <Input
                  id="d-units"
                  inputMode="decimal"
                  value={dUnitsBought}
                  onChange={(e) => setDUnitsBought(e.target.value)}
                  placeholder="เช่น 0.25"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-price" className="text-xs">
                  ราคา/หน่วย (ไม่บังคับ)
                </Label>
                <Input
                  id="d-price"
                  inputMode="decimal"
                  value={dPricePerUnit}
                  onChange={(e) => setDPricePerUnit(e.target.value)}
                  placeholder="เช่น 540"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-fee" className="text-xs">
                  ค่าธรรมเนียม (บาท)
                </Label>
                <Input
                  id="d-fee"
                  inputMode="decimal"
                  value={dFeeThb}
                  onChange={(e) => setDFeeThb(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="d-note">หมายเหตุ (ไม่บังคับ)</Label>
              <Input
                id="d-note"
                value={dNote}
                onChange={(e) => setDNote(e.target.value)}
                placeholder="เช่น ซื้อ DCA รอบสิ้นเดือนผ่าน Dime"
              />
            </div>

            {isDbMode && wallets.length >= 2 ? (
              <div className="space-y-2.5 rounded-xl border bg-muted/30 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={dCreateTransfer}
                    onChange={(e) => setDCreateTransfer(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-teal-700"
                  />
                  <span>สร้างรายการโอนเงินเข้ากระเป๋าลงทุนอัตโนมัติ</span>
                </label>

                {dCreateTransfer ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="d-from-wallet" className="text-xs">
                        โอนจากบัญชี
                      </Label>
                      <AppSelect
                        id="d-from-wallet"
                        value={dSourceWalletId}
                        onValueChange={setDSourceWalletId}
                        options={wallets.map((w) => ({
                          value: w.id,
                          label: w.name,
                          dotColor: w.color ?? "#0f766e",
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="d-to-wallet" className="text-xs">
                        เข้ากระเป๋าลงทุน
                      </Label>
                      <AppSelect
                        id="d-to-wallet"
                        value={dTargetWalletId}
                        onValueChange={setDTargetWalletId}
                        options={wallets
                          .filter((w) => w.id !== dSourceWalletId)
                          .map((w) => ({
                            value: w.id,
                            label: w.name,
                            dotColor: w.color ?? "#10b981",
                          }))}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDcaDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={isMutating}
                className="bg-teal-700 text-white hover:bg-teal-800"
              >
                {isMutating ? "กำลังบันทึก..." : "ยืนยันบันทึกซื้อ DCA"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Dividend Dialog (Phase 9B) */}
      <Dialog open={divDialogOpen} onOpenChange={setDivDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              บันทึกเงินปันผล {divHolding ? `• ${divHolding.symbol}` : ""}
            </DialogTitle>
            <DialogDescription>
              บวกยอดเงินปันผลสะสมเข้าสินทรัพย์นี้ พร้อมตัวเลือกจดเป็นรายรับลงบัญชี
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDividendSubmit} className="space-y-4">
            {vError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {vError}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="v-date">วันที่รับปันผล</Label>
                <Input
                  id="v-date"
                  type="date"
                  value={vDate}
                  onChange={(e) => setVDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-amount">ยอดปันผลสุทธิ (บาท)</Label>
                <Input
                  id="v-amount"
                  inputMode="decimal"
                  value={vAmountThb}
                  onChange={(e) => setVAmountThb(e.target.value)}
                  placeholder="250.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="v-note">หมายเหตุ (ไม่บังคับ)</Label>
              <Input
                id="v-note"
                value={vNote}
                onChange={(e) => setVNote(e.target.value)}
                placeholder="เช่น ปันผลไตรมาส 4 หลังหักภาษี"
              />
            </div>

            {isDbMode && wallets.length > 0 && incomeCategories.length > 0 ? (
              <div className="space-y-2.5 rounded-xl border bg-muted/30 p-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={vCreateIncome}
                    onChange={(e) => setVCreateIncome(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-teal-700"
                  />
                  <span>บันทึกรายรับเข้ากระเป๋าเงินอัตโนมัติ</span>
                </label>

                {vCreateIncome ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="v-wallet" className="text-xs">
                        กระเป๋าที่รับเงิน
                      </Label>
                      <AppSelect
                        id="v-wallet"
                        value={vWalletId}
                        onValueChange={setVWalletId}
                        options={wallets.map((w) => ({
                          value: w.id,
                          label: w.name,
                          dotColor: w.color ?? "#0f766e",
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="v-category" className="text-xs">
                        หมวดหมู่รายรับ
                      </Label>
                      <AppSelect
                        id="v-category"
                        value={vCategoryId}
                        onValueChange={setVCategoryId}
                        options={incomeCategories.map((c) => ({
                          value: c.id,
                          label: c.name,
                          dotColor: c.color ?? "#10b981",
                        }))}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDivDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={isMutating}
                className="bg-teal-700 text-white hover:bg-teal-800"
              >
                {isMutating ? "กำลังบันทึก..." : "บันทึกเงินปันผล"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
