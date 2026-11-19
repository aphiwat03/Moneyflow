import { NextRequest, NextResponse } from "next/server";
import { getBangkokToday, isValidIsoCalendarDate } from "@/lib/date";
import { buildMoneyFlowWorkbook } from "@/lib/excel";
import { getUserTransactions } from "@/lib/finance-queries";
import { getOptionalUser } from "@/lib/session";
import type { TransactionFilterParams, TransactionType } from "@/lib/types";

const VALID_TYPES = new Set(["all", "income", "expense", "transfer"]);

export async function GET(request: NextRequest) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const rawType = sp.get("type") ?? "all";
  const type = VALID_TYPES.has(rawType)
    ? (rawType as TransactionType | "all")
    : "all";

  const startDate = sp.get("startDate") ?? undefined;
  const endDate = sp.get("endDate") ?? undefined;

  if (startDate && !isValidIsoCalendarDate(startDate)) {
    return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
  }
  if (endDate && !isValidIsoCalendarDate(endDate)) {
    return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
  }

  const filters: TransactionFilterParams = {
    type,
    walletId: sp.get("walletId") ?? undefined,
    categoryId: sp.get("categoryId") ?? undefined,
    q: sp.get("q") ?? undefined,
    startDate,
    endDate,
  };

  const rows = await getUserTransactions(user.id, filters);

  const periodLabel =
    startDate && endDate
      ? `${startDate} ถึง ${endDate}`
      : startDate
        ? `ตั้งแต่ ${startDate}`
        : endDate
          ? `ถึง ${endDate}`
          : "ทั้งหมด";

  const bytes = await buildMoneyFlowWorkbook({
    transactions: rows,
    periodLabel,
  });

  const fileTag =
    startDate && endDate
      ? `${startDate}_to_${endDate}`
      : getBangkokToday().slice(0, 7);
  const filename = `MoneyFlow_${fileTag}.xlsx`;

  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
