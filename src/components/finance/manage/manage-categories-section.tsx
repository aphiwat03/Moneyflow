"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
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
import { formatMoneyDisplay } from "@/lib/decimal";
import type { ActionResult, CategoryDTO, CategoryType } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ManageNotice } from "./manage-wallets-section";

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

interface ManageCategoriesSectionProps {
  categories: CategoryDTO[];
  showArchived: boolean;
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
  onNotify: (notice: ManageNotice | null) => void;
}

export function ManageCategoriesSection({
  categories,
  showArchived,
  onCreateCategory,
  onUpdateCategory,
  onToggleArchiveCategory,
  onDeleteCategory,
  onNotify,
}: ManageCategoriesSectionProps) {
  const [catTabState, setCatTabState] = useState<{
    current: CategoryType;
    direction: "left" | "right" | "none";
  }>({ current: "expense", direction: "none" });

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
    onNotify(null);
    const res = await onDeleteCategory(cat.id);
    if (!res.ok) {
      onNotify({
        type: "error",
        message: res.error ?? "ลบหมวดหมู่ไม่สำเร็จ",
      });
    } else {
      onNotify({
        type: "success",
        message: `ลบหมวดหมู่ "${cat.name}" เรียบร้อยแล้ว`,
      });
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
                    aria-label={
                      cat.isArchived ? "กู้คืนหมวดหมู่" : "ซ่อนหมวดหมู่"
                    }
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
                      className="ml-0.5 text-destructive hover:text-destructive max-lg:size-9"
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
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">
              หมวดหมู่รายรับ - รายจ่าย &amp; งบประมาณรายเดือน
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
    </>
  );
}
