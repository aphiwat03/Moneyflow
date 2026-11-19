import { parseThaiBankSlip, type OcrLineItem } from "@/lib/slip-parser";
import {
  SlipOcrProviderError,
  type SlipOcrProvider,
  type SlipOcrScanRequest,
  type SlipOcrScanResponse,
} from "./types";

interface WorkerOcrResponse {
  provider?: string;
  model?: string;
  revision?: string;
  text?: string;
  lines?: OcrLineItem[];
  durationMs?: number;
  error?: string;
}

const DEFAULT_WORKER_URL = "http://127.0.0.1:8001";

export const localOpenThaiOcrProvider: SlipOcrProvider = {
  name: "local",

  async scan({
    buffer,
    mimeType,
    signal,
  }: SlipOcrScanRequest): Promise<SlipOcrScanResponse> {
    const baseUrl = (process.env.OCR_WORKER_URL || DEFAULT_WORKER_URL).replace(
      /\/+$/,
      ""
    );
    const timeoutSignal = AbortSignal.timeout(30_000);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/ocr`, {
        method: "POST",
        headers: {
          "Content-Type": mimeType || "application/octet-stream",
        },
        body: new Uint8Array(buffer),
        signal: combinedSignal,
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new SlipOcrProviderError(
          signal?.aborted
            ? "ยกเลิกการอ่านสลิปแล้ว"
            : "ระบบอ่านสลิปใช้เวลานานเกินกำหนด (Timeout)",
          signal?.aborted ? 499 : 504
        );
      }
      throw new SlipOcrProviderError(
        "ระบบอ่านสลิปในเครื่อง (Local OCR Worker) ยังไม่ทำงาน กรุณารัน npm run ocr:start ก่อน",
        503
      );
    }

    let payload: WorkerOcrResponse;
    try {
      payload = (await response.json()) as WorkerOcrResponse;
    } catch {
      throw new SlipOcrProviderError(
        "ไม่สามารถอ่านผลลัพธ์จาก Local OCR Worker ได้",
        502
      );
    }

    if (!response.ok) {
      throw new SlipOcrProviderError(
        payload.error || "Local OCR Worker ไม่สามารถอ่านรูปสลิปนี้ได้",
        response.status >= 400 && response.status < 500 ? 422 : 502
      );
    }

    const rawText = String(payload.text ?? "");
    const parsed = parseThaiBankSlip(rawText, payload.lines);

    return {
      provider: "local",
      isMock: false,
      model: `${payload.model ?? "OpenThai2.1-OCR-Text-20261118"} (${payload.revision ?? "v2.1.4"})`,
      durationMs:
        typeof payload.durationMs === "number" ? payload.durationMs : 0,
      rawText,
      amount: parsed.amount,
      transactionDate: parsed.transactionDate,
      suggestedNote: parsed.suggestedNote,
      bankHint: parsed.bankHint,
      confidence: parsed.confidence,
      warnings: parsed.warnings,
    };
  },
};
