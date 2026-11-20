"use client";

import type Decimal from "decimal.js";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoneyDisplay, toDecimal } from "@/lib/decimal";
import { cn } from "@/lib/utils";

interface DashboardKpiCardsProps {
  spendingTotal: Decimal;
  creditCardDebtTotal: string;
  periodIncome: string;
  periodExpense: string;
  periodNet: string;
  monthLabel: string;
}

export function DashboardKpiCards({
  spendingTotal,
  creditCardDebtTotal,
  periodIncome,
  periodExpense,
  periodNet,
  monthLabel,
}: DashboardKpiCardsProps) {
  const periodNetDecimal = toDecimal(periodNet);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5 font-medium text-foreground">
            <Wallet className="h-4 w-4 text-teal-600" />
            เงินในกระเป๋าใช้จ่ายทั่วไป
          </CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            ฿{formatMoneyDisplay(spendingTotal)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          ไม่รวมกระเป๋าเป้าหมายและบัตรเครดิต
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5 font-medium text-foreground">
            <CreditCard className="h-4 w-4 text-amber-600" />
            ยอดค้างชำระบัตรเครดิต
          </CardDescription>
          <CardTitle className="text-2xl text-amber-600 tabular-nums">
            ฿{formatMoneyDisplay(creditCardDebtTotal)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          แยกออกจากเงินสดและเงินฝาก
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5 font-medium text-foreground">
            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
            รายรับ ({monthLabel})
          </CardDescription>
          <CardTitle className="text-2xl text-emerald-600 tabular-nums">
            +฿{formatMoneyDisplay(periodIncome)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          ไม่รวมรายการโอนย้ายระหว่างบัญชี
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5 font-medium text-foreground">
            <ArrowUpRight className="h-4 w-4 text-rose-600" />
            รายจ่าย ({monthLabel})
          </CardDescription>
          <CardTitle className="text-2xl text-rose-600 tabular-nums">
            -฿{formatMoneyDisplay(periodExpense)}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          กระแสเงินสดสุทธิเดือนนี้:{" "}
          <span
            className={cn(
              "whitespace-nowrap font-semibold tabular-nums",
              periodNetDecimal.gte(0) ? "text-emerald-600" : "text-rose-600"
            )}
          >
            {periodNetDecimal.gte(0) ? "+" : "-"}฿
            {formatMoneyDisplay(periodNetDecimal.abs())}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
