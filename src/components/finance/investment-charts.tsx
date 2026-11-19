"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoneyDisplay } from "@/lib/decimal";
import type {
  ComputedInvestmentHolding,
  InvestmentProjectionPoint,
} from "@/lib/types";

function formatCompactMoney(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${m.toFixed(m >= 10 || Number.isInteger(m) ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `${k.toFixed(k >= 100 || Number.isInteger(k) ? 0 : 0)}k`;
  }
  return String(Math.round(value));
}

export function InvestmentProjectionChart({
  points,
  targetGoal,
}: {
  points: InvestmentProjectionPoint[];
  targetGoal: number;
}) {
  if (points.length <= 1) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        กรอกยอด DCA ต่อเดือนหรือเงินต้นเพื่อดูกราฟจำลองการเติบโต
      </div>
    );
  }

  const maxProjected = points.reduce(
    (max, p) => Math.max(max, p.projectedValue),
    0
  );
  const showGoalLine =
    targetGoal > 0 && (maxProjected >= targetGoal * 0.25 || maxProjected === 0);

  return (
    <div className="h-64 w-full min-w-0 sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 12, right: 12, left: -8, bottom: 0 }}
        >
          <defs>
            <linearGradient id="mfProjValueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="mfContributedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e2e8f0"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickFormatter={formatCompactMoney}
          />
          <Tooltip
            formatter={(val, name) => [
              `฿${formatMoneyDisplay(Number(val ?? 0))}`,
              name === "projectedValue"
                ? "มูลค่าพอร์ตรวมทบต้น"
                : "เงินต้นที่ใส่สะสม",
            ]}
            labelFormatter={(label, payload) => {
              const p = payload?.[0]?.payload as
                | InvestmentProjectionPoint
                | undefined;
              return p ? `${label} (พ.ศ. ${p.buddhistYear})` : String(label);
            }}
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
          />
          {showGoalLine ? (
            <ReferenceLine
              y={targetGoal}
              stroke="#f59e0b"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              label={{
                value: `เป้า ฿${formatCompactMoney(targetGoal)}`,
                position: "insideTopRight",
                fill: "#d97706",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="projectedValue"
            name="projectedValue"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#mfProjValueGrad)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="contributed"
            name="contributed"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#mfContributedGrad)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InvestmentAllocationDonutChart({
  holdings,
  monthlyDca,
}: {
  holdings: ComputedInvestmentHolding[];
  monthlyDca: string;
}) {
  const activeHoldings = holdings.filter((h) => h.targetAllocationPct > 0);

  if (activeHoldings.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
        เพิ่มหุ้น / กองทุน และกำหนดสัดส่วน % เพื่อดูภาพรวมการจัดพอร์ต DCA
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative h-48 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={activeHoldings}
              dataKey="targetAllocationPct"
              nameKey="symbol"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={2}
              isAnimationActive={false}
            >
              {activeHoldings.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(val) => [`${Number(val ?? 0)}%`, "สัดส่วนเป้าหมาย"]}
              contentStyle={{
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-muted-foreground">DCA ต่อเดือน</span>
          <span className="text-sm font-bold tabular-nums">
            ฿{formatMoneyDisplay(monthlyDca)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {activeHoldings.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="font-semibold">{item.symbol}</span>
              <span className="truncate text-muted-foreground">{item.name}</span>
            </div>
            <div className="shrink-0 text-right tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">
                ฿{formatMoneyDisplay(item.monthlyDcaAmount)}/ด.
              </span>{" "}
              ({item.targetAllocationPct}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
