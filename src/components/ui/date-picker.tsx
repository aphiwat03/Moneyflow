"use client";

import * as React from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { formatIsoDateForDisplay, isValidIsoCalendarDate } from "@/lib/date";
import { cn } from "@/lib/utils";

const THAI_MONTHS_SHORT = [
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

function parseIsoToLocalDate(iso: string): Date | undefined {
  if (!isValidIsoCalendarDate(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLocalDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface AppDatePickerProps {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
}

export function AppDatePicker({
  id,
  value,
  onChange,
  placeholder = "เลือกวันที่",
  allowClear = false,
  disabled = false,
  className,
}: AppDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selectedDate = React.useMemo(() => parseIsoToLocalDate(value), [value]);

  return (
    <BasePopover.Root open={open} onOpenChange={setOpen}>
      <div className={cn("relative flex items-center", className)}>
        <BasePopover.Trigger
          id={id}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-1 text-left text-sm shadow-xs transition-colors outline-none",
            "hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
            !selectedDate && "text-muted-foreground",
            allowClear && value ? "pr-8" : ""
          )}
        >
          <span className="flex min-w-0 items-center gap-2 truncate tabular-nums">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selectedDate ? formatIsoDateForDisplay(value) : placeholder}
            </span>
          </span>
        </BasePopover.Trigger>

        {allowClear && value && !disabled ? (
          <button
            type="button"
            aria-label="ล้างวันที่"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      <BasePopover.Portal>
        <BasePopover.Positioner sideOffset={6} align="start" className="z-[100]">
          <BasePopover.Popup
            className={cn(
              "rounded-xl border bg-popover text-popover-foreground shadow-lg outline-none",
              "transition-[opacity,transform] duration-150 ease-out",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
            )}
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate ?? new Date()}
              onSelect={(date) => {
                if (date) {
                  onChange(formatLocalDateToIso(date));
                  setOpen(false);
                }
              }}
            />
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

interface AppMonthPickerProps {
  id?: string;
  value: string;
  onChange: (monthKey: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AppMonthPicker({
  id,
  value,
  onChange,
  placeholder = "เลือกเดือน",
  disabled = false,
  className,
}: AppMonthPickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = /^(\d{4})-(\d{2})$/.exec(value);
  const selectedYear = parsed ? Number(parsed[1]) : new Date().getFullYear();
  const selectedMonth = parsed ? Number(parsed[2]) : null;
  const [viewYear, setViewYear] = React.useState(selectedYear);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && parsed) {
      setViewYear(Number(parsed[1]));
    }
    setOpen(nextOpen);
  }

  const displayLabel =
    parsed && selectedMonth
      ? `${THAI_MONTHS_SHORT[selectedMonth - 1]} ${selectedYear + 543}`
      : placeholder;

  return (
    <BasePopover.Root open={open} onOpenChange={handleOpenChange}>
      <BasePopover.Trigger
        id={id}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-1 text-left text-sm shadow-xs transition-colors outline-none",
          "hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          !parsed && "text-muted-foreground",
          className
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate tabular-nums">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{displayLabel}</span>
        </span>
      </BasePopover.Trigger>

      <BasePopover.Portal>
        <BasePopover.Positioner sideOffset={6} align="start" className="z-[100]">
          <BasePopover.Popup
            className={cn(
              "w-64 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg outline-none",
              "transition-[opacity,transform] duration-150 ease-out",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
            )}
          >
            <div className="mb-2.5 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => setViewYear((y) => y - 1)}
                aria-label="ปีก่อนหน้า"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-sm font-semibold tabular-nums">
                พ.ศ. {viewYear + 543}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => setViewYear((y) => y + 1)}
                aria-label="ปีถัดไป"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {THAI_MONTHS_SHORT.map((label, idx) => {
                const monthNum = idx + 1;
                const isSelected =
                  selectedYear === viewYear && selectedMonth === monthNum;
                return (
                  <Button
                    key={label}
                    type="button"
                    variant={isSelected ? "default" : "ghost"}
                    size="sm"
                    onClick={() => {
                      onChange(
                        `${viewYear}-${String(monthNum).padStart(2, "0")}`
                      );
                      setOpen(false);
                    }}
                    className={cn(
                      "h-8 text-xs",
                      isSelected &&
                        "bg-teal-700 text-white hover:bg-teal-800"
                    )}
                  >
                    {label}
                  </Button>
                );
              })}
            </div>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
