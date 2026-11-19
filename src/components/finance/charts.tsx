"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoneyDisplay } from "@/lib/decimal";
import type { CategoryBreakdownPoint, MonthlyChartPoint } from "@/lib/types";

function formatCompactBaht(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  }
  return String(value);
}

export function MonthlyTrendChart({ data }: { data: MonthlyChartPoint[] }) {
  const hasAnyValue = data.some((d) => d.income > 0 || d.expense > 0);

  if (!hasAnyValue) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        ยังไม่มีข้อมูลรายรับ-รายจ่ายในช่วง 6 เดือนนี้
      </div>
    );
  }

  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickFormatter={formatCompactBaht}
          />
          <Tooltip
            formatter={(val, name) => [
              `฿${formatMoneyDisplay(Number(val ?? 0))}`,
              name === "income" ? "รายรับ" : "รายจ่าย",
            ]}
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
          />
          <Bar
            dataKey="income"
            name="income"
            fill="#10b981"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
          <Bar
            dataKey="expense"
            name="expense"
            fill="#f43f5e"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpenseDonutChart({
  data,
  totalExpense,
}: {
  data: CategoryBreakdownPoint[];
  totalExpense: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        ยังไม่มีรายจ่ายในเดือนที่เลือก
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative h-48 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="chartValue"
              nameKey="name"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(val) => [
                `฿${formatMoneyDisplay(Number(val ?? 0))}`,
                "ยอดใช้จ่าย",
              ]}
              contentStyle={{
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">รายจ่ายรวม</span>
          <span className="text-sm font-bold tabular-nums">
            ฿{formatMoneyDisplay(totalExpense)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {data.slice(0, 6).map((item) => (
          <div
            key={item.categoryId}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate font-medium">{item.name}</span>
            </div>
            <div className="shrink-0 tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">
                ฿{formatMoneyDisplay(item.amount)}
              </span>{" "}
              ({item.percentage}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
