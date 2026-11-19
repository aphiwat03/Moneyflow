"use client";

import { useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Download,
  HardDriveDownload,
  KeyRound,
  Pencil,
  Plus,
  Scale,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import type { SalarySettingsFormInput } from "@/actions/salary-plan";
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
import { getBangkokToday } from "@/lib/date";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import {
  parseBackupBundle,
  type MoneyFlowBackupBundle,
} from "@/lib/portable-backup";
import type {
  ActionResult,
  CategoryDTO,
  CategoryType,
  SalarySettingsDTO,
  WalletDTO,
  WalletType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const WALLET_TYPE_LABEL: Record<WalletType, string> = {
  cash: "เงินสด",
  bank: "บัญชีธนาคาร",
  credit_card: "บัตรเครดิต",
  ewallet: "E-Wallet",
  savings_goal: "กระเป๋าเก็บตามเป้าหมาย",
  investment: "พอร์ตหุ้น / การลงทุน",
};

const COLOR_PRESETS = [
  "#0f766e",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f97316",
  "#ec4899",
  "#ef4444",
  "#eab308",
  "#64748b",
];

interface ManageViewProps {
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  salarySettings?: SalarySettingsDTO | null;
  userProfile?: {
    name: string | null;
    email: string;
  } | null;
  onSaveSalarySettings?: (
    input: SalarySettingsFormInput
  ) => Promise<ActionResult<unknown>>;
  onCreateWallet: (input: {
    name: string;
    type: WalletType;
    initialBalance: string;
    color?: string | null;
  }) => Promise<ActionResult<unknown>>;
  onUpdateWallet: (
    walletId: string,
    input: {
      name: string;
      type: WalletType;
      initialBalance: string;
      color?: string | null;
    }
  ) => Promise<ActionResult<unknown>>;
  onToggleArchiveWallet: (
    walletId: string,
    isArchived: boolean
  ) => Promise<ActionResult<unknown>>;
  onDeleteWallet?: (walletId: string) => Promise<ActionResult<unknown>>;
  onAdjustWalletBalance?: (input: {
    walletId: string;
    actualBalance: string;
  }) => Promise<ActionResult<unknown>>;
  onCreateCategory: (input: {
    name: string;
    type: CategoryType;
    monthlyBudget?: string | null;
    color?: string | null;
  }) => Promise<ActionResult<unknown>>;
  onUpdateCategory: (
    categoryId: string,
    input: {
      name: string;
      type: CategoryType;
      monthlyBudget?: string | null;
      color?: string | null;
    }
  ) => Promise<ActionResult<unknown>>;
  onToggleArchiveCategory: (
    categoryId: string,
    isArchived: boolean
  ) => Promise<ActionResult<unknown>>;
  onDeleteCategory?: (categoryId: string) => Promise<ActionResult<unknown>>;
  onUpdateProfile?: (input: {
    name: string;
  }) => Promise<ActionResult<{ name: string }>>;
  onChangePassword?: (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<ActionResult<unknown>>;
  onExportFullBackup?: () => Promise<ActionResult<MoneyFlowBackupBundle>>;
  onRestoreFullBackup?: (
    bundle: MoneyFlowBackupBundle
  ) => Promise<
    ActionResult<{
      walletsCount: number;
      categoriesCount: number;
      transactionsCount: number;
      allocationsCount: number;
    }>
  >;
}

export function ManageView({
  wallets,
  categories,
  salarySettings,
  userProfile,
  onSaveSalarySettings,
  onCreateWallet,
  onUpdateWallet,
  onToggleArchiveWallet,
  onDeleteWallet,
  onAdjustWalletBalance,
  onCreateCategory,
  onUpdateCategory,
  onToggleArchiveCategory,
  onDeleteCategory,
  onUpdateProfile,
  onChangePassword,
  onExportFullBackup,
  onRestoreFullBackup,
}: ManageViewProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<{
    type: "error" | "success";
    message: string;
  } | null>(null);

  const [catTabState, setCatTabState] = useState<{
    current: CategoryType;
    direction: "left" | "right" | "none";
  }>({ current: "expense", direction: "none" });

  // Wallet modal state
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletDTO | null>(null);
  const [walletName, setWalletName] = useState("");
  const [walletType, setWalletType] = useState<WalletType>("bank");
  const [walletInitial, setWalletInitial] = useState("0.00");
  const [walletColor, setWalletColor] = useState(COLOR_PRESETS[0]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletSaving, setWalletSaving] = useState(false);

  // Adjust balance modal state
  const [adjustingWallet, setAdjustingWallet] = useState<WalletDTO | null>(null);
  const [actualBalanceInput, setActualBalanceInput] = useState("0.00");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Category modal state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryDTO | null>(
    null
  );
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<CategoryType>("expense");
  const [catMonthlyBudget, setCatMonthlyBudget] = useState("");
  const [catColor, setCatColor] = useState(COLOR_PRESETS[4]);
  const [catError, setCatError] = useState<string | null>(null);
  const [catSaving, setCatSaving] = useState(false);

  // Account settings state
  const [profileName, setProfileName] = useState(userProfile?.name ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Salary & Payday settings state
  const activeWallets = wallets.filter((w) => !w.isArchived);
  const [manageSalaryInput, setManageSalaryInput] = useState(
    salarySettings && toDecimal(salarySettings.monthlySalary).gt(0)
      ? salarySettings.monthlySalary
      : ""
  );
  const [manageExtraIncomeInput, setManageExtraIncomeInput] = useState(
    salarySettings && toDecimal(salarySettings.extraIncome ?? "0").gt(0)
      ? (salarySettings.extraIncome ?? "")
      : ""
  );
  const [managePaydayInput, setManagePaydayInput] = useState(
    String(salarySettings?.payday ?? 1)
  );
  const [manageSalaryWalletId, setManageSalaryWalletId] = useState(
    salarySettings?.salaryWalletId ?? ""
  );
  const [manageSalarySaving, setManageSalarySaving] = useState(false);

  // Full backup & restore state
  const [backupExporting, setBackupExporting] = useState(false);
  const [backupRestoring, setBackupRestoring] = useState(false);
  const [pendingRestoreBundle, setPendingRestoreBundle] =
    useState<MoneyFlowBackupBundle | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  const visibleWallets = wallets.filter(
    (w) => showArchived || !w.isArchived
  );
  const archivedWithBalanceCount = wallets.filter(
    (w) => w.isArchived && !toDecimal(w.currentBalance).isZero()
  ).length;

  function openAddWallet() {
    setEditingWallet(null);
    setWalletName("");
    setWalletType("bank");
    setWalletInitial("0.00");
    setWalletColor(COLOR_PRESETS[2]);
    setWalletError(null);
    setWalletDialogOpen(true);
  }

  function openEditWallet(wallet: WalletDTO) {
    setEditingWallet(wallet);
    setWalletName(wallet.name);
    setWalletType(wallet.type);
    setWalletInitial(wallet.initialBalance);
    setWalletColor(wallet.color ?? COLOR_PRESETS[0]);
    setWalletError(null);
    setWalletDialogOpen(true);
  }

  function openAdjustWallet(wallet: WalletDTO) {
    setAdjustingWallet(wallet);
    setActualBalanceInput(wallet.currentBalance);
    setAdjustError(null);
  }

  async function handleWalletSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWalletError(null);
    setWalletSaving(true);
    try {
      const payload = {
        name: walletName,
        type: walletType,
        initialBalance: walletInitial.trim() || "0.00",
        color: walletColor,
      };
      const result = editingWallet
        ? await onUpdateWallet(editingWallet.id, payload)
        : await onCreateWallet(payload);

      if (!result.ok) {
        const firstErr = result.fieldErrors
          ? Object.values(result.fieldErrors).flat()[0]
          : undefined;
        setWalletError(firstErr ?? result.error ?? "บันทึกกระเป๋าเงินไม่สำเร็จ");
        return;
      }
      setWalletDialogOpen(false);
    } finally {
      setWalletSaving(false);
    }
  }

  async function handleAdjustBalanceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingWallet || !onAdjustWalletBalance) return;
    setAdjustError(null);
    setAdjustSaving(true);
    try {
      const res = await onAdjustWalletBalance({
        walletId: adjustingWallet.id,
        actualBalance: actualBalanceInput.trim() || "0.00",
      });
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        setAdjustError(firstErr ?? res.error ?? "ปรับยอดคงเหลือไม่สำเร็จ");
        return;
      }
      setAdjustingWallet(null);
      setGlobalNotice({
        type: "success",
        message: `ปรับยอดคงเหลือของ "${adjustingWallet.name}" เรียบร้อยแล้ว`,
      });
    } finally {
      setAdjustSaving(false);
    }
  }

  async function handleDeleteWalletClick(wallet: WalletDTO) {
    if (!onDeleteWallet) return;
    setGlobalNotice(null);
    const res = await onDeleteWallet(wallet.id);
    if (!res.ok) {
      setGlobalNotice({
        type: "error",
        message: res.error ?? "ลบกระเป๋าเงินไม่สำเร็จ",
      });
    } else {
      setGlobalNotice({
        type: "success",
        message: `ลบกระเป๋าเงิน "${wallet.name}" เรียบร้อยแล้ว`,
      });
    }
  }

  function openAddCategory(defaultType: CategoryType) {
    setEditingCategory(null);
    setCatName("");
    setCatType(defaultType);
    setCatMonthlyBudget("");
    setCatColor(defaultType === "income" ? COLOR_PRESETS[1] : COLOR_PRESETS[4]);
    setCatError(null);
    setCatDialogOpen(true);
  }

  function openEditCategory(cat: CategoryDTO) {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatType(cat.type);
    setCatMonthlyBudget(cat.monthlyBudget ?? "");
    setCatColor(cat.color ?? COLOR_PRESETS[8]);
    setCatError(null);
    setCatDialogOpen(true);
  }

  async function handleCategorySubmit(e: React.FormEvent) {
    e.preventDefault();
    setCatError(null);
    setCatSaving(true);
    try {
      const payload = {
        name: catName,
        type: catType,
        monthlyBudget:
          catType === "expense" && catMonthlyBudget.trim()
            ? catMonthlyBudget.trim()
            : null,
        color: catColor,
      };
      const result = editingCategory
        ? await onUpdateCategory(editingCategory.id, payload)
        : await onCreateCategory(payload);

      if (!result.ok) {
        const firstErr = result.fieldErrors
          ? Object.values(result.fieldErrors).flat()[0]
          : undefined;
        setCatError(firstErr ?? result.error ?? "บันทึกหมวดหมู่ไม่สำเร็จ");
        return;
      }
      setCatDialogOpen(false);
    } finally {
      setCatSaving(false);
    }
  }

  async function handleDeleteCategoryClick(cat: CategoryDTO) {
    if (!onDeleteCategory) return;
    setGlobalNotice(null);
    const res = await onDeleteCategory(cat.id);
    if (!res.ok) {
      setGlobalNotice({
        type: "error",
        message: res.error ?? "ลบหมวดหมู่ไม่สำเร็จ",
      });
    } else {
      setGlobalNotice({
        type: "success",
        message: `ลบหมวดหมู่ "${cat.name}" เรียบร้อยแล้ว`,
      });
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onUpdateProfile) return;
    setProfileSaving(true);
    setGlobalNotice(null);
    try {
      const res = await onUpdateProfile({ name: profileName });
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        setGlobalNotice({
          type: "error",
          message: firstErr ?? res.error ?? "อัปเดตชื่อโปรไฟล์ไม่สำเร็จ",
        });
      } else {
        setGlobalNotice({
          type: "success",
          message: "อัปเดตชื่อโปรไฟล์เรียบร้อยแล้ว",
        });
      }
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onChangePassword) return;
    setPasswordSaving(true);
    setGlobalNotice(null);
    try {
      const res = await onChangePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        setGlobalNotice({
          type: "error",
          message: firstErr ?? res.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ",
        });
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setGlobalNotice({
          type: "success",
          message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว",
        });
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleSalarySettingsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSaveSalarySettings) return;
    setManageSalarySaving(true);
    setGlobalNotice(null);
    try {
      const res = await onSaveSalarySettings({
        monthlySalary: manageSalaryInput.trim() || "0",
        extraIncome: manageExtraIncomeInput.trim() || "0",
        payday: Number(managePaydayInput) || 1,
        salaryWalletId: manageSalaryWalletId || null,
      });
      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors).flat()[0]
          : undefined;
        setGlobalNotice({
          type: "error",
          message: firstErr ?? res.error ?? "บันทึกการตั้งค่าเงินเดือนไม่สำเร็จ",
        });
      } else {
        setGlobalNotice({
          type: "success",
          message: `บันทึกเงินเดือนและวันเงินออก (ทุกวันที่ ${Number(managePaydayInput) || 1}) เรียบร้อยแล้ว`,
        });
      }
    } finally {
      setManageSalarySaving(false);
    }
  }

  async function handleExportFullBackupClick() {
    if (!onExportFullBackup) return;
    setBackupExporting(true);
    setGlobalNotice(null);
    try {
      const res = await onExportFullBackup();
      if (!res.ok || !res.data) {
        setGlobalNotice({
          type: "error",
          message: res.error ?? "ไม่สามารถส่งออกไฟล์สำรองข้อมูลได้",
        });
        return;
      }

      const jsonText = JSON.stringify(res.data, null, 2);
      const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `MoneyFlow_Backup_${getBangkokToday()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      setGlobalNotice({
        type: "success",
        message: `ส่งออกไฟล์สำรองข้อมูลเรียบร้อย (${res.data.wallets.length} กระเป๋า, ${res.data.transactions.length} รายการ)`,
      });
    } catch {
      setGlobalNotice({
        type: "error",
        message: "เกิดข้อผิดพลาดในการสร้างไฟล์สำรองข้อมูล",
      });
    } finally {
      setBackupExporting(false);
    }
  }

  async function handleBackupFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setGlobalNotice(null);
    try {
      const text = await file.text();
      const parsed = parseBackupBundle(text);
      if (!parsed.ok) {
        setGlobalNotice({
          type: "error",
          message: parsed.error,
        });
        return;
      }
      setPendingRestoreBundle(parsed.data);
    } catch {
      setGlobalNotice({
        type: "error",
        message: "ไม่สามารถอ่านไฟล์ที่เลือกได้ กรุณาตรวจสอบว่าเป็นไฟล์ .json",
      });
    }
  }

  async function handleConfirmRestoreBackup() {
    if (!pendingRestoreBundle || !onRestoreFullBackup) return;
    setBackupRestoring(true);
    setGlobalNotice(null);
    try {
      const res = await onRestoreFullBackup(pendingRestoreBundle);
      if (!res.ok) {
        setGlobalNotice({
          type: "error",
          message: res.error ?? "กู้คืนข้อมูลจากไฟล์สำรองไม่สำเร็จ",
        });
        return;
      }
      setPendingRestoreBundle(null);
      setGlobalNotice({
        type: "success",
        message: res.data
          ? `กู้คืนข้อมูลเรียบร้อย (${res.data.walletsCount} กระเป๋า, ${res.data.categoriesCount} หมวดหมู่, ${res.data.allocationsCount} เป้าหมาย, ${res.data.transactionsCount} รายการ)`
          : "กู้คืนข้อมูลจากไฟล์สำรองเรียบร้อยแล้ว",
      });
    } finally {
      setBackupRestoring(false);
    }
  }

  function renderCategoryList(type: CategoryType) {
    const list = categories.filter(
      (c) => c.type === type && (showArchived || !c.isArchived)
    );

    return (
      <div className="space-y-2">
        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีหมวดหมู่ในกลุ่มนี้
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((cat) => (
              <div
                key={cat.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border bg-background p-3",
                  cat.isArchived && "opacity-60"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color ?? "#64748b" }}
                    />
                    <span className="truncate text-sm font-medium">
                      {cat.name}
                    </span>
                    {cat.isArchived ? (
                      <Badge variant="secondary" className="text-[10px]">
                        ซ่อนอยู่
                      </Badge>
                    ) : null}
                  </div>
                  {cat.type === "expense" && cat.monthlyBudget ? (
                    <p className="mt-0.5 pl-5 text-xs text-muted-foreground tabular-nums">
                      งบรายเดือน: ฿{formatMoneyDisplay(cat.monthlyBudget)}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1 max-lg:gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="max-lg:size-9"
                    aria-label="แก้ไขหมวดหมู่"
                    title="แก้ไข"
                    onClick={() => openEditCategory(cat)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="max-lg:size-9"
                    aria-label={cat.isArchived ? "กู้คืนหมวดหมู่" : "ซ่อนหมวดหมู่"}
                    title={cat.isArchived ? "กู้คืน" : "ซ่อนไว้ (Archive)"}
                    onClick={() =>
                      onToggleArchiveCategory(cat.id, !cat.isArchived)
                    }
                  >
                    {cat.isArchived ? (
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  {onDeleteCategory ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="ลบหมวดหมู่"
                      title="ลบถาวร (เฉพาะหมวดหมู่ที่ยังไม่มีรายการ)"
                      className="max-lg:size-9 ml-0.5 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteCategoryClick(cat)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            กระเป๋าเงิน หมวดหมู่ และบัญชีผู้ใช้
          </h1>
          <p className="text-sm text-muted-foreground">
            ปรับยอดคงเหลือ ตั้งงบประมาณรายเดือน ซ่อน (Archive) หรือลบรายการที่ไม่ใช้แล้ว
          </p>
        </div>

        <Button
          type="button"
          variant={showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowArchived((s) => !s)}
        >
          {showArchived ? "ซ่อนรายการที่ Archive ไว้" : "แสดงรายการที่ Archive"}
        </Button>
      </div>

      {globalNotice ? (
        <div
          role={globalNotice.type === "error" ? "alert" : "status"}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            globalNotice.type === "error"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          )}
        >
          {globalNotice.message}
        </div>
      ) : null}

      {/* Wallets Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">กระเป๋าเงิน / บัญชี</CardTitle>
            <CardDescription>
              รองรับเงินสด ธนาคาร บัตรเครดิต E-Wallet กระเป๋าเป้าหมาย และพอร์ตหุ้น/ลงทุน พร้อมปุ่มปรับยอดให้ตรงกับเงินจริง
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={openAddWallet}
            className="shrink-0 gap-1 bg-teal-700 text-white hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            <span>เพิ่มกระเป๋า</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {archivedWithBalanceCount > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              มีกระเป๋าที่ถูกซ่อน (Archive) และยังมียอดคงเหลืออยู่ {archivedWithBalanceCount} กระเป๋า
              (ยอดของกระเป๋าที่ซ่อนจะไม่ถูกนับรวมใน Net Worth บนหน้าภาพรวม)
            </div>
          ) : null}
          {visibleWallets.length === 0 ? (
            <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีกระเป๋าเงิน
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleWallets.map((wallet) => {
                const bal = toDecimal(wallet.currentBalance);
                return (
                  <div
                    key={wallet.id}
                    className={cn(
                      "flex flex-col justify-between gap-3 rounded-xl border bg-background p-4",
                      wallet.isArchived && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor: wallet.color ?? "#0f766e",
                            }}
                          />
                          <p className="truncate font-semibold">{wallet.name}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {WALLET_TYPE_LABEL[wallet.type]}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 max-lg:gap-1.5">
                        {onAdjustWalletBalance ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="max-lg:size-9"
                            aria-label="ปรับยอดคงเหลือปัจจุบัน"
                            title="ปรับยอดคงเหลือให้ตรงกับเงินจริง"
                            onClick={() => openAdjustWallet(wallet)}
                          >
                            <Scale className="h-3.5 w-3.5 text-teal-600" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="max-lg:size-9"
                          aria-label="แก้ไขกระเป๋าเงิน"
                          title="แก้ไข"
                          onClick={() => openEditWallet(wallet)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="max-lg:size-9"
                          aria-label={
                            wallet.isArchived ? "กู้คืนกระเป๋า" : "ซ่อนกระเป๋า"
                          }
                          title={wallet.isArchived ? "กู้คืน" : "ซ่อนไว้ (Archive)"}
                          onClick={() =>
                            onToggleArchiveWallet(wallet.id, !wallet.isArchived)
                          }
                        >
                          {wallet.isArchived ? (
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          ) : (
                            <Archive className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        {onDeleteWallet ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="ลบกระเป๋าเงิน"
                            title="ลบถาวร (เฉพาะกระเป๋าที่ยังไม่มีรายการ)"
                            className="max-lg:size-9 ml-0.5 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteWalletClick(wallet)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between border-t pt-2.5 text-xs">
                      <span className="text-muted-foreground">
                        {wallet.type === "credit_card" && bal.isNegative()
                          ? "ยอดค้างชำระ"
                          : "ยอดคงเหลือ"}
                      </span>
                      <span
                        className={cn(
                          "text-base font-bold tabular-nums",
                          wallet.type === "credit_card" && bal.isNegative()
                            ? "text-amber-600"
                            : "text-foreground"
                        )}
                      >
                        ฿
                        {formatMoneyDisplay(
                          wallet.type === "credit_card" && bal.isNegative()
                            ? bal.abs()
                            : bal
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categories Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">
              หมวดหมู่รายรับ - รายจ่าย & งบประมาณรายเดือน
            </CardTitle>
            <CardDescription>
              จัดกลุ่มรายการและกำหนดเพดานงบประมาณรายเดือนสำหรับหมวดหมู่รายจ่าย
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openAddCategory(catTabState.current)}
            className="shrink-0 gap-1"
          >
            <Plus className="h-4 w-4" />
            <span>เพิ่มหมวดหมู่</span>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative inline-grid w-full max-w-xs grid-cols-2 rounded-xl bg-muted p-1">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/2)] rounded-lg bg-background shadow-sm transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none"
              style={{
                transform: `translate3d(${catTabState.current === "expense" ? 0 : 100}%, 0, 0)`,
              }}
            />
            {(
              [
                { value: "expense", label: "หมวดหมู่รายจ่าย" },
                { value: "income", label: "หมวดหมู่รายรับ" },
              ] as const
            ).map((tab) => {
              const active = catTabState.current === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    if (catTabState.current === tab.value) return;
                    setCatTabState({
                      current: tab.value,
                      direction: tab.value === "income" ? "right" : "left",
                    });
                  }}
                  className={cn(
                    "relative z-10 h-8 rounded-lg px-3 text-sm font-medium transition-colors duration-200",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <SmoothExpand watchKey={catTabState.current} className="-mx-1">
            <div
              key={catTabState.current}
              className={cn(
                "py-0.5",
                catTabState.direction === "right"
                  ? "animate-mf-slide-right"
                  : catTabState.direction === "left"
                    ? "animate-mf-slide-left"
                    : ""
              )}
            >
              {renderCategoryList(catTabState.current)}
            </div>
          </SmoothExpand>
        </CardContent>
      </Card>

      {/* Salary & Payday Settings Card */}
      {onSaveSalarySettings ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-teal-600" />
              <span>ตั้งค่าเงินเดือน & วันที่เงินเดือนออก</span>
            </CardTitle>
            <CardDescription>
              กำหนดฐานเงินเดือนคงที่และวันที่เงินเข้า (เช่น ทุกวันที่ 1, 15, 25 หรือสิ้นเดือน)
              เพื่อใช้คำนวณรอบเดือนในหน้าแผนเงินเดือน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSalarySettingsSubmit} className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">
                  เลือกวันเงินออกด่วน:
                </span>
                {[
                  { day: 1, label: "ทุกวันที่ 1" },
                  { day: 5, label: "วันที่ 5" },
                  { day: 15, label: "วันที่ 15" },
                  { day: 25, label: "วันที่ 25" },
                  { day: 31, label: "สิ้นเดือน (31)" },
                ].map((preset) => {
                  const active = Number(managePaydayInput) === preset.day;
                  return (
                    <button
                      key={preset.day}
                      type="button"
                      onClick={() => setManagePaydayInput(String(preset.day))}
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

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="manage-salary">เงินเดือนคงที่ (บาท/เดือน)</Label>
                  <Input
                    id="manage-salary"
                    inputMode="decimal"
                    placeholder="0 (ถ้ายังไม่เริ่มงาน)"
                    value={manageSalaryInput}
                    onChange={(e) => setManageSalaryInput(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="manage-extra-income">
                    รายได้เสริม / Part-time (บาท)
                  </Label>
                  <Input
                    id="manage-extra-income"
                    inputMode="decimal"
                    placeholder="เช่น 2500"
                    value={manageExtraIncomeInput}
                    onChange={(e) => setManageExtraIncomeInput(e.target.value)}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="manage-payday">วันที่เงินเดือนออก (1–31)</Label>
                  <AppSelect
                    id="manage-payday"
                    value={managePaydayInput}
                    onValueChange={setManagePaydayInput}
                    options={Array.from({ length: 31 }, (_, idx) => {
                      const d = idx + 1;
                      return {
                        value: String(d),
                        label:
                          d === 31
                            ? "วันที่ 31 (หรือวันสิ้นเดือน)"
                            : `วันที่ ${d} ของทุกเดือน`,
                      };
                    })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="manage-salary-wallet">
                    กระเป๋ารับเงิน (ไม่บังคับ)
                  </Label>
                  <AppSelect
                    id="manage-salary-wallet"
                    value={manageSalaryWalletId}
                    onValueChange={setManageSalaryWalletId}
                    options={[
                      { value: "", label: "ไม่ระบุ" },
                      ...activeWallets.map((w) => ({
                        value: w.id,
                        label: w.name,
                        dotColor: w.color ?? "#0f766e",
                      })),
                    ]}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={manageSalarySaving}
                  className="h-10 bg-teal-700 px-6 text-white hover:bg-teal-800 md:h-9"
                >
                  {manageSalarySaving ? "กำลังบันทึก..." : "บันทึกวันเงินออก & รายได้"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* Portable Full Backup & Restore Card (PC Migration) */}
      {onExportFullBackup || onRestoreFullBackup ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDriveDownload className="h-4 w-4 text-teal-600" />
              <span>ย้ายเครื่อง / สำรองและกู้คืนข้อมูลทั้งหมด (.json)</span>
            </CardTitle>
            <CardDescription>
              ส่งออกข้อมูลทั้งหมด (กระเป๋าเงิน หมวดหมู่ ตั้งค่าเงินเดือน เป้าหมายออม/DCA และรายการรับ-จ่าย-โอนทุกวัน)
              เป็นไฟล์ .json เดียวเพื่อย้ายข้ามเครื่อง หรือย้ายจากโหมดทดลอง UI เข้า PostgreSQL ได้ทันที
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {onExportFullBackup ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportFullBackupClick}
                  disabled={backupExporting || backupRestoring}
                  className="h-auto min-h-10 w-full max-w-full gap-1.5 py-2 text-left whitespace-normal sm:w-auto"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span>
                    {backupExporting
                      ? "กำลังสร้างไฟล์สำรอง..."
                      : "ดาวน์โหลดไฟล์สำรองข้อมูล (.json สำหรับย้ายเครื่อง)"}
                  </span>
                </Button>
              ) : null}

              {onRestoreFullBackup ? (
                <>
                  <input
                    ref={backupFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleBackupFileChange}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => backupFileInputRef.current?.click()}
                    disabled={backupExporting || backupRestoring}
                    className="h-auto min-h-10 w-full max-w-full gap-1.5 py-2 text-left whitespace-normal sm:w-auto"
                  >
                    <Upload className="h-4 w-4 shrink-0" />
                    <span>นำเข้า / กู้คืนจากไฟล์สำรอง (.json)</span>
                  </Button>
                </>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              หมายเหตุ: การกู้คืนจากไฟล์สำรองจะแทนที่ข้อมูลเดิมในบัญชี/โหมดปัจจุบันทั้งหมดด้วยข้อมูลจากไฟล์ที่เลือก
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Account & Security Card */}
      {userProfile && (onUpdateProfile || onChangePassword) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {onUpdateProfile ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-teal-600" />
                  <span>ข้อมูลบัญชีผู้ใช้</span>
                </CardTitle>
                <CardDescription>
                  แก้ไขชื่อที่แสดงบน Dashboard และเมนูผู้ใช้งาน
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-email">อีเมล</Label>
                    <Input
                      id="profile-email"
                      value={userProfile.email}
                      disabled
                      className="opacity-70"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name">ชื่อที่แสดง</Label>
                    <Input
                      id="profile-name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="ชื่อของคุณ"
                      required
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={profileSaving}>
                    {profileSaving ? "กำลังบันทึก..." : "บันทึกชื่อโปรไฟล์"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {onChangePassword ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRound className="h-4 w-4 text-teal-600" />
                  <span>เปลี่ยนรหัสผ่าน</span>
                </CardTitle>
                <CardDescription>
                  กำหนดรหัสผ่านใหม่สำหรับเข้าสู่ระบบด้วยอีเมล
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="current-password">รหัสผ่านปัจจุบัน</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password">รหัสผ่านใหม่</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={8}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={8}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" size="sm" disabled={passwordSaving}>
                    {passwordSaving ? "กำลังเปลี่ยนรหัสผ่าน..." : "เปลี่ยนรหัสผ่าน"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Wallet Modal */}
      <Dialog open={walletDialogOpen} onOpenChange={setWalletDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingWallet ? "แก้ไขกระเป๋าเงิน" : "เพิ่มกระเป๋าเงินใหม่"}
            </DialogTitle>
            <DialogDescription>
              ตั้งชื่อ เลือกประเภท และกำหนดยอดเริ่มต้นของกระเป๋าเงิน
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleWalletSubmit} className="space-y-4">
            <div>
              <SmoothExpand watchKey={walletError ?? ""} className="-mx-1">
                {walletError ? (
                  <p className="mb-4 animate-mf-fade-up rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {walletError}
                  </p>
                ) : null}
              </SmoothExpand>

              {!editingWallet ? (
                <div className="mb-3 space-y-1.5">
                  <span className="text-xs text-muted-foreground">
                    เทมเพลตกระเป๋าแยกยอดนิยม:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "📈 พอร์ตหุ้น / DCA",
                        name: "พอร์ตหุ้น / DCA",
                        type: "investment" as WalletType,
                        color: "#10b981",
                      },
                      {
                        label: "💝 กระเป๋าซื้อของให้แฟน",
                        name: "กระเป๋าซื้อของให้แฟน",
                        type: "savings_goal" as WalletType,
                        color: "#ec4899",
                      },
                      {
                        label: "⌚ กระเป๋าของที่อยากได้",
                        name: "กระเป๋าของที่อยากได้",
                        type: "savings_goal" as WalletType,
                        color: "#f97316",
                      },
                      {
                        label: "❄️ บัญชีเงินเย็นสำรอง",
                        name: "บัญชีเงินเย็นสำรอง",
                        type: "savings_goal" as WalletType,
                        color: "#3b82f6",
                      },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setWalletName(preset.name);
                          setWalletType(preset.type);
                          setWalletColor(preset.color);
                        }}
                        className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-teal-600/40 hover:bg-teal-600/10 hover:text-foreground"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor="wallet-name">ชื่อกระเป๋าเงิน / บัญชี</Label>
                <Input
                  id="wallet-name"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  placeholder="เช่น SCB ออมทรัพย์, พอร์ตหุ้น, ของที่อยากได้"
                  required
                />
              </div>
            </div>

            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wallet-type">ประเภท</Label>
                  <AppSelect
                    id="wallet-type"
                    value={walletType}
                    onValueChange={(nextValue) =>
                      setWalletType(nextValue as WalletType)
                    }
                    options={[
                      { value: "cash", label: "เงินสด", dotColor: "#0f766e" },
                      {
                        value: "bank",
                        label: "บัญชีธนาคาร (ใช้จ่ายทั่วไป)",
                        dotColor: "#3b82f6",
                      },
                      { value: "ewallet", label: "E-Wallet", dotColor: "#8b5cf6" },
                      {
                        value: "savings_goal",
                        label: "กระเป๋าเก็บตามเป้าหมาย (ของที่อยากได้ / แฟน / เงินเย็น)",
                        dotColor: "#f97316",
                      },
                      {
                        value: "investment",
                        label: "พอร์ตหุ้น / กองทุน / DCA",
                        dotColor: "#10b981",
                      },
                      { value: "credit_card", label: "บัตรเครดิต", dotColor: "#eab308" },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="wallet-initial">ยอดตั้งต้น (บาท)</Label>
                  <Input
                    id="wallet-initial"
                    inputMode="decimal"
                    value={walletInitial}
                    onChange={(e) => setWalletInitial(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <SmoothExpand watchKey={walletType === "credit_card"} className="-mx-1">
                {walletType === "credit_card" ? (
                  <p className="mt-3 animate-mf-fade-up rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    สำหรับบัตรเครดิต หากมียอดค้างชำระตั้งต้นให้ใส่เครื่องหมายลบ เช่น{" "}
                    <span className="font-mono font-semibold">-5000.00</span>
                  </p>
                ) : null}
              </SmoothExpand>
            </div>

            <div className="space-y-1.5">
              <Label>สีประจำกระเป๋า</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`เลือกสี ${color}`}
                    onClick={() => setWalletColor(color)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform max-lg:h-9 max-lg:w-9",
                      walletColor === color
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
                onClick={() => setWalletDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={walletSaving}>
                {walletSaving ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Wallet Current Balance Modal */}
      <Dialog
        open={Boolean(adjustingWallet)}
        onOpenChange={(open) => {
          if (!open) setAdjustingWallet(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              ปรับยอดคงเหลือปัจจุบัน ({adjustingWallet?.name})
            </DialogTitle>
            <DialogDescription>
              ระบุยอดเงินจริงที่มีอยู่ในกระเป๋าตอนนี้ ระบบจะปรับยอดตั้งต้นให้อัตโนมัติโดยไม่กระทบรายการรับ-จ่ายเดิม
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdjustBalanceSubmit} className="space-y-4">
            {adjustError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {adjustError}
              </p>
            ) : null}

            <div className="rounded-lg border bg-muted/40 p-3 text-xs">
              ยอดคงเหลือในระบบปัจจุบัน:{" "}
              <strong className="tabular-nums">
                ฿
                {adjustingWallet
                  ? formatMoneyDisplay(adjustingWallet.currentBalance)
                  : "0.00"}
              </strong>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actual-balance">
                ยอดเงินจริงที่มีอยู่ปัจจุบัน (บาท)
              </Label>
              <Input
                id="actual-balance"
                inputMode="decimal"
                value={actualBalanceInput}
                onChange={(e) => setActualBalanceInput(e.target.value)}
                placeholder="0.00"
                required
              />
              {adjustingWallet?.type === "credit_card" ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  สำหรับบัตรเครดิต ให้ระบุยอดหนี้ค้างชำระเป็นค่าติดลบ (เช่น -3500.00) หรือ 0.00 หากจ่ายครบแล้ว
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustingWallet(null)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={adjustSaving}>
                {adjustSaving ? "กำลังปรับยอด..." : "ยืนยันการปรับยอด"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Modal */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}
            </DialogTitle>
            <DialogDescription>
              ระบุชื่อหมวดหมู่ ประเภท งบประมาณรายเดือน และสีสำหรับแสดงในกราฟ
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCategorySubmit} className="space-y-4">
            {catError ? (
              <p className="animate-mf-fade-up rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {catError}
              </p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="cat-name">ชื่อหมวดหมู่</Label>
              <Input
                id="cat-name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="เช่น ค่ากาแฟ, โบนัส"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cat-type">ประเภท</Label>
                <AppSelect
                  id="cat-type"
                  value={catType}
                  disabled={Boolean(editingCategory)}
                  onValueChange={(nextValue) =>
                    setCatType(nextValue as CategoryType)
                  }
                  options={[
                    { value: "expense", label: "รายจ่าย", dotColor: "#e11d48" },
                    { value: "income", label: "รายรับ", dotColor: "#10b981" },
                  ]}
                />
              </div>

              {catType === "expense" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="cat-budget">
                    งบรายเดือน (บาท, เว้นว่างได้)
                  </Label>
                  <Input
                    id="cat-budget"
                    inputMode="decimal"
                    value={catMonthlyBudget}
                    onChange={(e) => setCatMonthlyBudget(e.target.value)}
                    placeholder="เช่น 5000.00"
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>สีหมวดหมู่</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`เลือกสี ${color}`}
                    onClick={() => setCatColor(color)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-transform max-lg:h-9 max-lg:w-9",
                      catColor === color
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
                onClick={() => setCatDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={catSaving}>
                {catSaving ? "กำลังบันทึก..." : "บันทึก"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Restore Full Backup Confirmation Modal */}
      <Dialog
        open={Boolean(pendingRestoreBundle)}
        onOpenChange={(open) => {
          if (!open && !backupRestoring) setPendingRestoreBundle(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการกู้คืนข้อมูลจากไฟล์สำรอง</DialogTitle>
            <DialogDescription>
              ระบบจะเขียนทับข้อมูลกระเป๋า หมวดหมู่ แผนเงินเดือน และรายการทั้งหมดในบัญชีปัจจุบันด้วยข้อมูลจากไฟล์นี้
            </DialogDescription>
          </DialogHeader>

          {pendingRestoreBundle ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-xs">
                <p>
                  วันที่ส่งออกไฟล์:{" "}
                  <strong className="font-mono">
                    {pendingRestoreBundle.exportedAt.slice(0, 19).replace("T", " ")}
                  </strong>
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div>
                    กระเป๋าเงิน:{" "}
                    <strong className="tabular-nums">
                      {pendingRestoreBundle.wallets.length}
                    </strong>{" "}
                    รายการ
                  </div>
                  <div>
                    หมวดหมู่:{" "}
                    <strong className="tabular-nums">
                      {pendingRestoreBundle.categories.length}
                    </strong>{" "}
                    รายการ
                  </div>
                  <div>
                    เป้าหมายออม/DCA:{" "}
                    <strong className="tabular-nums">
                      {pendingRestoreBundle.salaryAllocations.length}
                    </strong>{" "}
                    รายการ
                  </div>
                  <div>
                    รายการรับ-จ่าย-โอน:{" "}
                    <strong className="tabular-nums">
                      {pendingRestoreBundle.transactions.length}
                    </strong>{" "}
                    รายการ
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                คำแนะนำ: หากมีข้อมูลสำคัญอยู่ในเครื่องนี้ แนะนำให้กดดาวน์โหลดไฟล์สำรองปัจจุบันเก็บไว้ก่อนกู้คืน
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={backupRestoring}
              onClick={() => setPendingRestoreBundle(null)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handleConfirmRestoreBackup}
              disabled={backupRestoring}
              className="bg-teal-700 text-white hover:bg-teal-800"
            >
              {backupRestoring ? "กำลังกู้คืนข้อมูล..." : "ยืนยันกู้คืนข้อมูลทั้งหมด"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
