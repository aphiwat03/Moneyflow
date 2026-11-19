import { NextRequest, NextResponse } from "next/server";
import * as z from "zod";
import { getBangkokToday, isValidIsoCalendarDate } from "@/lib/date";
import { buildMoneyFlowWorkbook } from "@/lib/excel";
import { positiveMoneyStringSchema, WALLET_TYPES } from "@/lib/validations";

const demoTransactionSchema = z.object({
  id: z.string().max(64),
  type: z.enum(["income", "expense", "transfer"]),
  walletId: z.string().max(64),
  walletName: z.string().max(120),
  walletType: z.enum(WALLET_TYPES),
  toWalletId: z.string().max(64).nullable(),
  toWalletName: z.string().max(120).nullable(),
  categoryId: z.string().max(64).nullable(),
  categoryName: z.string().max(120).nullable(),
  categoryColor: z.string().max(24).nullable(),
  amount: positiveMoneyStringSchema,
  transactionDate: z.string().refine(isValidIsoCalendarDate),
  note: z.string().max(1000).nullable(),
});

const demoExportBodySchema = z.object({
  periodLabel: z.string().max(120).default("ตัวอย่างข้อมูล"),
  transactions: z.array(demoTransactionSchema).max(200),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = demoExportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid export payload" },
      { status: 400 }
    );
  }

  const bytes = await buildMoneyFlowWorkbook({
    transactions: parsed.data.transactions,
    periodLabel: parsed.data.periodLabel,
  });

  const filename = `MoneyFlow_Demo_${getBangkokToday()}.xlsx`;

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
