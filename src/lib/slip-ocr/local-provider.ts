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
    const sharedSecret = process.env.OCR_SHARED_SECRET?.trim();
    const requestHeaders: Record<string, string> = {
      "Content-Type": mimeType || "application/octet-stream",
    };
    if (sharedSecret) {
      requestHeaders["X-OCR-API-KEY"] = sharedSecret;
    }

    try {
      response = await fetch(`${baseUrl}/ocr`, {
        method: "POST",
        headers: requestHeaders,
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
      if (response.status === 401 || response.status === 403) {
        throw new SlipOcrProviderError(
          "การยืนยันตัวตนกับระบบอ่านสลิปไม่ถูกต้อง กรุณาตรวจสอบการตั้งค่าเซิร์ฟเวอร์",
          502
        );
      }
      if (response.status === 413) {
        throw new SlipOcrProviderError(
          "ขนาดหรือความละเอียดของรูปสลิปเกินขีดจำกัดที่ระบบรองรับ",
          413
        );
      }
      throw new SlipOcrProviderError(
        response.status >= 400 && response.status < 500
          ? "ไม่สามารถถอดข้อความจากรูปสลิปนี้ได้ กรุณาลองใช้รูปที่ชัดเจนขึ้น"
          : "ระบบอ่านสลิปขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
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
      transactionTime: parsed.transactionTime,
      suggestedNote: parsed.suggestedNote,
      bankHint: parsed.bankHint,
      recipientName: parsed.recipientName,
      recipientBank: parsed.recipientBank,
      recipientAccount: parsed.recipientAccount,
      confidence: parsed.confidence,
      warnings: parsed.warnings,
    };
  },
};
