import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { investmentHoldings } from "@/db/schema";
import { toDecimal } from "@/lib/decimal";
import { computeUnitMarketValueThb } from "@/lib/investment-calc";
import {
  fetchMarketQuote,
  fetchUsdThbRate,
  isSupportedMarketTicker,
} from "@/lib/investment-prices";
import { checkMemoryRateLimit } from "@/lib/rate-limit";
import { getOptionalUser } from "@/lib/session";

const REFRESH_PRICES_RATE_LIMIT = 2;
const REFRESH_PRICES_WINDOW_MS = 30 * 1000; // 30 seconds per user

export async function POST() {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json(
      { error: "กรุณาเข้าสู่ระบบก่อนอัปเดตราคาตลาด" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rate = checkMemoryRateLimit({
    key: `refresh-prices:user:${user.id}`,
    limit: REFRESH_PRICES_RATE_LIMIT,
    windowMs: REFRESH_PRICES_WINDOW_MS,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "เพิ่งอัปเดตราคาตลาดไปเมื่อสักครู่ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง" },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rate.retryAfterSec),
        },
      }
    );
  }

  try {
    const holdings = await db
      .select()
      .from(investmentHoldings)
      .where(eq(investmentHoldings.userId, user.id));

    const eligible = holdings.filter(
      (h) =>
        h.units !== null &&
        toDecimal(h.units).gt(0) &&
        isSupportedMarketTicker(h.symbol, h.assetType)
    );

    if (eligible.length === 0) {
      return NextResponse.json(
        {
          updatedCount: 0,
          skippedCount: holdings.length,
          failedSymbols: [],
          usdThbRate: null,
          updatedHoldings: [],
          message:
            "ยังไม่มีสินทรัพย์ที่ระบุจำนวนหน่วย (Units > 0) และมีรหัสหุ้น/ETF มาตรฐานสำหรับดึงราคาอัตโนมัติ",
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const quotes = await Promise.all(
      eligible.map(async (h) => ({
        holding: h,
        quote: await fetchMarketQuote(h.symbol),
      }))
    );

    const needsFx = quotes.some((q) => q.quote?.currency === "USD");
    const usdThbRate = needsFx ? await fetchUsdThbRate() : null;

    const failedSymbols: string[] = [];
    const updatedHoldings: Array<{
      id: string;
      symbol: string;
      currentValue: string;
      currency: "THB" | "USD";
      unitPrice: number;
    }> = [];

    for (const { holding, quote } of quotes) {
      if (!quote) {
        failedSymbols.push(holding.symbol);
        continue;
      }
      if (quote.currency === "USD" && !usdThbRate) {
        failedSymbols.push(holding.symbol);
        continue;
      }

      const nextValueThb = computeUnitMarketValueThb({
        units: holding.units!,
        unitPrice: quote.price,
        currency: quote.currency,
        usdThbRate,
      });

      await db
        .update(investmentHoldings)
        .set({
          currentValue: nextValueThb,
          currency: quote.currency,
        })
        .where(
          and(
            eq(investmentHoldings.id, holding.id),
            eq(investmentHoldings.userId, user.id)
          )
        );

      updatedHoldings.push({
        id: holding.id,
        symbol: holding.symbol,
        currentValue: nextValueThb,
        currency: quote.currency,
        unitPrice: quote.price,
      });
    }

    if (updatedHoldings.length > 0) {
      revalidatePath("/investments");
    }

    return NextResponse.json(
      {
        updatedCount: updatedHoldings.length,
        skippedCount: holdings.length - eligible.length,
        failedSymbols,
        usdThbRate,
        updatedHoldings,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[POST /api/investments/refresh-prices]", error);
    return NextResponse.json(
      { error: "ไม่สามารถดึงราคาตลาดล่าสุดได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
