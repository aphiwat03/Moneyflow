import { getBangkokToday } from "@/lib/date";
import { parseThaiBankSlip } from "@/lib/slip-parser";
import {
  SlipOcrProviderError,
  type SlipOcrProvider,
  type SlipOcrScanRequest,
  type SlipOcrScanResponse,
} from "./types";

function waitWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new SlipOcrProviderError("ยกเลิกการอ่านสลิปแล้ว", 499));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new SlipOcrProviderError("ยกเลิกการอ่านสลิปแล้ว", 499));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function buildSimulatedSlipText(fileSize: number): string {
  const todayIso = getBangkokToday();
  const presets = [
    {
      bank: "K PLUS",
      recipient: "ร้านกาแฟอเมซอน",
      amount: "145.00",
    },
    {
      bank: "SCB",
      recipient: "7-Eleven สาขาสามย่าน",
      amount: "285.50",
    },
    {
      bank: "Krungthai",
      recipient: "บจก. แกร็บแท็กซี่",
      amount: "120.00",
    },
  ];
  const pick = presets[fileSize % presets.length];
  return [
    pick.bank,
    "โอนเงินสำเร็จ",
    todayIso,
    `ไปยัง ${pick.recipient}`,
    `จำนวนเงิน ${pick.amount} บาท`,
    "ค่าธรรมเนียม 0.00 บาท",
  ].join("\n");
}

export const geminiMockOcrProvider: SlipOcrProvider = {
  name: "gemini",

  async scan({
    buffer,
    signal,
  }: SlipOcrScanRequest): Promise<SlipOcrScanResponse> {
    const started = Date.now();
    await waitWithSignal(350, signal);

    const simulatedText = buildSimulatedSlipText(buffer.byteLength);
    const parsed = parseThaiBankSlip(simulatedText);

    return {
      provider: "gemini",
      isMock: true,
      model: "gemini-2.5-flash (mock)",
      durationMs: Date.now() - started,
      rawText: simulatedText,
      amount: parsed.amount,
      transactionDate: parsed.transactionDate,
      suggestedNote: parsed.suggestedNote,
      bankHint: parsed.bankHint,
      confidence: parsed.confidence,
      warnings: [
        ...parsed.warnings,
        "กำลังใช้โหมดจำลอง Gemini API (ตั้งค่า GEMINI_API_KEY ในอนาคตเพื่อเชื่อมต่อ API จริง)",
      ],
    };
  },
};
