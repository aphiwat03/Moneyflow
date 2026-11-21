"use client";

import { CalendarDays, List, RotateCcw, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppDatePicker } from "@/components/ui/date-picker";
import { AppSelect } from "@/components/ui/select";
import type {
  CategoryDTO,
  TransactionFilterParams,
  TransactionType,
  WalletDTO,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface TransactionsFilterBarProps {
  filters: TransactionFilterParams;
  wallets: WalletDTO[];
  categories: CategoryDTO[];
  viewMode: "list" | "daily" | "recipients";
  filteredCount: number;
  onUpdateFilters: (
    updater: (prev: TransactionFilterParams) => TransactionFilterParams
  ) => void;
  onResetFilters: () => void;
  onChangeViewMode: (mode: "list" | "daily" | "recipients") => void;
}

export function TransactionsFilterBar({
  filters,
  wallets,
  categories,
  viewMode,
  filteredCount,
  onUpdateFilters,
  onResetFilters,
  onChangeViewMode,
}: TransactionsFilterBarProps) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="relative sm:col-span-2 lg:col-span-4">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="ค้นหาหมายเหตุ, ผู้รับโอน, หมวดหมู่, กระเป๋า..."
              value={filters.q ?? ""}
              onChange={(e) =>
                onUpdateFilters((f) => ({ ...f, q: e.target.value }))
              }
              className="h-10 pl-9 lg:h-9"
            />
          </div>

          <div className="lg:col-span-2">
            <AppSelect
              ariaLabel="กรองตามประเภท"
              value={filters.type ?? "all"}
              onValueChange={(nextValue) =>
                onUpdateFilters((f) => ({
                  ...f,
                  type: nextValue as TransactionType | "all",
                }))
              }
              className="lg:h-9"
              options={[
                { value: "all", label: "ทุกประเภท" },
                { value: "expense", label: "รายจ่าย", dotColor: "#e11d48" },
                { value: "income", label: "รายรับ", dotColor: "#10b981" },
                { value: "transfer", label: "โอนย้าย", dotColor: "#0284c7" },
              ]}
            />
          </div>

          <div className="lg:col-span-3">
            <AppSelect
              ariaLabel="กรองตามกระเป๋าเงิน"
              value={filters.walletId ?? "all"}
              onValueChange={(nextValue) =>
                onUpdateFilters((f) => ({ ...f, walletId: nextValue }))
              }
              className="lg:h-9"
              options={[
                { value: "all", label: "ทุกกระเป๋าเงิน" },
                ...wallets.map((w) => ({
                  value: w.id,
                  label: w.name,
                  dotColor: w.color ?? "#0f766e",
                  badge: w.isArchived ? "ซ่อนอยู่" : null,
                })),
              ]}
            />
          </div>

          <div className="lg:col-span-3">
            <AppSelect
              ariaLabel="กรองตามหมวดหมู่"
              value={filters.categoryId ?? "all"}
              onValueChange={(nextValue) =>
                onUpdateFilters((f) => ({ ...f, categoryId: nextValue }))
              }
              className="lg:h-9"
              options={[
                { value: "all", label: "ทุกหมวดหมู่" },
                ...categories.map((c) => ({
                  value: c.id,
                  label: c.name,
                  dotColor: c.color ?? "#64748b",
                  badge: c.type === "income" ? "รายรับ" : "รายจ่าย",
                })),
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <span className="text-xs text-muted-foreground">ช่วงวันที่:</span>
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:flex sm:w-auto sm:items-center sm:gap-2">
              <AppDatePicker
                value={filters.startDate ?? ""}
                onChange={(val) =>
                  onUpdateFilters((f) => ({ ...f, startDate: val }))
                }
                placeholder="ตั้งแต่วันที่"
                allowClear
                className="w-full sm:w-40"
              />
              <span className="text-xs text-muted-foreground">ถึง</span>
              <AppDatePicker
                value={filters.endDate ?? ""}
                onChange={(val) =>
                  onUpdateFilters((f) => ({ ...f, endDate: val }))
                }
                placeholder="ถึงวันที่"
                allowClear
                className="w-full sm:w-40"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="gap-1 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>ล้างตัวกรอง</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="inline-flex flex-wrap rounded-lg border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => onChangeViewMode("daily")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  viewMode === "daily"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span>จัดกลุ่มรายวัน</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeViewMode("list")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-3.5 w-3.5 shrink-0" />
                <span>ตารางรวม</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeViewMode("recipients")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                  viewMode === "recipients"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>ผู้รับโอน</span>
              </button>
            </div>
            <span className="whitespace-nowrap text-muted-foreground">
              พบ <strong>{filteredCount}</strong> รายการ
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
