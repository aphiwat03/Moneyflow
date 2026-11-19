import { NextRequest, NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/session";
import {
  getSlipOcrProvider,
  resolveSlipOcrProviderName,
  SlipOcrProviderError,
} from "@/lib/slip-ocr";

const MAX_SLIP_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function hasValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.byteLength < 12) return false;
  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export async function POST(request: NextRequest) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json(
      { error: "กรุณาเข้าสู่ระบบก่อนใช้งานระบบอ่านสลิป" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น multipart/form-data)" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const fileEntry = formData.get("file");
  if (
    !fileEntry ||
    typeof fileEntry === "string" ||
    typeof fileEntry.arrayBuffer !== "function"
  ) {
    return NextResponse.json(
      { error: "กรุณาแนบไฟล์รูปภาพสลิป" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(fileEntry.type)) {
    return NextResponse.json(
      { error: "รองรับเฉพาะไฟล์รูปภาพ PNG, JPEG และ WEBP เท่านั้น" },
      { status: 415, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (fileEntry.size <= 0 || fileEntry.size > MAX_SLIP_BYTES) {
    return NextResponse.json(
      { error: "ขนาดไฟล์สลิปต้องไม่เกิน 5 MB" },
      { status: 413, headers: { "Cache-Control": "no-store" } }
    );
  }

  const buffer = Buffer.from(await fileEntry.arrayBuffer());
  if (!hasValidImageSignature(buffer, fileEntry.type)) {
    return NextResponse.json(
      { error: "เนื้อหาไฟล์ไม่ตรงกับประเภทรูปภาพที่ระบุ" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const providerEntry = formData.get("provider");
  const providerName = resolveSlipOcrProviderName(
    typeof providerEntry === "string" ? providerEntry : null
  );
  const provider = getSlipOcrProvider(providerName);

  try {
    const result = await provider.scan({
      buffer,
      mimeType: fileEntry.type,
      fileName: fileEntry.name || "slip-image",
      signal: request.signal,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SlipOcrProviderError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: error.statusCode,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดระหว่างประมวลผลสลิป" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
