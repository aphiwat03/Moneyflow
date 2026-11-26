import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { getBangkokToday, isValidIsoCalendarDate } from "@/lib/date";
import { buildMoneyFlowWorkbook } from "@/lib/excel";
import { getUserTransactions } from "@/lib/finance-queries";
import { getOptionalUser } from "@/lib/session";
import type { TransactionFilterParams, TransactionType } from "@/lib/types";

const VALID_TYPES = new Set(["all", "income", "expense", "transfer"]);
const UUID_SCHEMA = z.string().uuid();
const MAX_QUERY_LENGTH = 100;
const MAX_EXPORT_ROWS = 10_000;

export async function GET(request: NextRequest) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const sp = request.nextUrl.searchParams;
  const rawType = sp.get("type") ?? "all";
  const type = VALID_TYPES.has(rawType)
    ? (rawType as TransactionType | "all")
    : "all";

  const startDate = sp.get("startDate") ?? undefined;
  const endDate = sp.get("endDate") ?? undefined;

  if (startDate && !isValidIsoCalendarDate(startDate)) {
    return NextResponse.json(
      { error: "Invalid startDate" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (endDate && !isValidIsoCalendarDate(endDate)) {
    return NextResponse.json(
      { error: "Invalid endDate" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rawWalletId = sp.get("walletId") ?? undefined;
  if (
    rawWalletId &&
    rawWalletId !== "all" &&
    !UUID_SCHEMA.safeParse(rawWalletId).success
  ) {
    return NextResponse.json(
      { error: "Invalid walletId" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rawCategoryId = sp.get("categoryId") ?? undefined;
  if (
    rawCategoryId &&
    rawCategoryId !== "all" &&
    !UUID_SCHEMA.safeParse(rawCategoryId).success
  ) {
    return NextResponse.json(
      { error: "Invalid categoryId" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rawTag = sp.get("tag")?.trim();
  if (rawTag && rawTag !== "all" && rawTag.length > 80) {
    return NextResponse.json(
      { error: "Invalid tag" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rawQ = sp.get("q")?.trim();
  if (rawQ && rawQ.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: "Search query exceeds maximum length" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const filters: TransactionFilterParams = {
    type,
    walletId: rawWalletId,
    categoryId: rawCategoryId,
    tag: rawTag || undefined,
    q: rawQ || undefined,
    startDate,
    endDate,
    limit: MAX_EXPORT_ROWS + 1,
  };

  try {
    const rows = await getUserTransactions(user.id, filters);

    if (rows.length > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        {
          error: `จำนวนรายการเกินขีดจำกัดการส่งออก (${MAX_EXPORT_ROWS.toLocaleString()} รายการ/ไฟล์) กรุณาระบุช่วงวันที่ให้แคบลง`,
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

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
  } catch (error) {
    console.error("[GET /api/export]", error);
    return NextResponse.json(
      { error: "ไม่สามารถสร้างไฟล์ Excel ได้ในขณะนี้" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
