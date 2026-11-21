import { isValidIsoCalendarDate, isValidTime24 } from "@/lib/date";
import { toDecimal } from "@/lib/decimal";
import { maskAccountNumber } from "@/lib/recipient-summary";
import type { WalletType } from "@/lib/types";

export interface OcrLineItem {
  text: string;
  confidence?: number;
  row?: number | null;
  box?: unknown;
}

export interface ParsedSlipResult {
  amount: string | null;
  transactionDate: string | null;
  transactionTime: string | null;
  suggestedNote: string | null;
  bankHint: string | null;
  recipientName: string | null;
  recipientBank: string | null;
  recipientAccount: string | null;
  confidence: number;
  warnings: string[];
}

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

const THAI_MONTH_MAP: Array<[RegExp, number]> = [
  [/ม\.?\s*ค\.?|มกราคม/u, 1],
  [/ก\.?\s*พ\.?|กุมภาพันธ์/u, 2],
  [/มี\.?\s*ค\.?|มีนาคม/u, 3],
  [/เม\.?\s*ย\.?|เมษายน/u, 4],
  [/พ\.?\s*ค\.?|พฤษภาคม/u, 5],
  [/มิ\.?\s*ย\.?|มิถุนายน/u, 6],
  [/ก\.?\s*ค\.?|กรกฎาคม/u, 7],
  [/ส\.?\s*ค\.?|สิงหาคม/u, 8],
  [/ก\.?\s*ย\.?|กันยายน/u, 9],
  [/ต\.?\s*ค\.?|ตุลาคม/u, 10],
  [/พ\.?\s*ย\.?|พฤศจิกายน/u, 11],
  [/ธ\.?\s*ค\.?|ธันวาคม/u, 12],
];

const EN_MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const BANK_MATCHERS: Array<[RegExp, string]> = [
  [/k\s*plus|กสิกรไทย|kasikorn|\bkbank\b/i, "K PLUS"],
  [/\bscb\b|ไทยพาณิชย์|scb\s*easy/i, "SCB"],
  [/krungthai|กรุงไทย|krungthai\s*next|\bktb\b/i, "Krungthai"],
  [/bangkok\s*bank|ธนาคารกรุงเทพ|\bbbl\b|bualuang/i, "BBL"],
  [/krungsri|กรุงศรี|\bbay\b|\bkma\b/i, "Krungsri"],
  [/\bttb\b|ทหารไทยธนชาต/i, "ttb"],
  [/ออมสิน|\bmymo\b|\bgsb\b/i, "GSB"],
  [/พร้อมเพย์|prompt\s*pay/i, "PromptPay"],
  [/truemoney|ทรูมันนี่/i, "TrueMoney"],
  [/\bcimb\b|ซีไอเอ็มบี/i, "CIMB"],
  [/\buob\b|ยูโอบี/i, "UOB"],
  [/\blh\s*bank\b|แลนด์\s*แอนด์\s*เฮ้าส์/i, "LH Bank"],
  [/\bkkp\b|เกียรตินาคิน/i, "KKP"],
  [/\btisco\b|ทิสโก้/i, "TISCO"],
  [/\bbaac\b|ธ\.?ก\.?ส\.?/iu, "BAAC"],
  [/\bghb\b|ธ\.?อ\.?ส\.?|อาคารสงเคราะห์/iu, "GHB"],
];

const AMOUNT_LABEL_REGEX =
  /จำนวนเงิน|จำนวน|ยอดโอน|ยอดชำระ|ชำระเงิน|ยอดเงิน|amount|total/iu;
const CURRENCY_MARKER_REGEX = /บาท|thb|฿/iu;
const FEE_LABEL_REGEX = /ค่าธรรมเนียม|fee|charge/iu;
const TIMESTAMP_CONTEXT_REGEX = /\d{1,2}\s*[.:]\s*\d{2}\s*(?:น\.?|am|pm|hrs?)/iu;
const MONTH_NAME_REGEX =
  /(?:ม\.?\s*ค\.?|ก\.?\s*พ\.?|มี\.?\s*ค\.?|เม\.?\s*ย\.?|พ\.?\s*ค\.?|มิ\.?\s*ย\.?|ก\.?\s*ค\.?|ส\.?\s*ค\.?|ก\.?\s*ย\.?|ต\.?\s*ค\.?|พ\.?\s*ย\.?|ธ\.?\s*ค\.?|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/iu;

export function normalizeThaiDigits(input: string): string {
  return input.replace(/[๐-๙]/g, (digit) => {
    const index = THAI_DIGITS.indexOf(digit);
    return index >= 0 ? String(index) : digit;
  });
}

function cleanSpaces(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function buildSearchLines(rawText: string, lines?: OcrLineItem[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (text: string) => {
    const cleaned = cleanSpaces(normalizeThaiDigits(text));
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  };

  if (lines && lines.length > 0) {
    // Group cells sharing the same visual row first so label + value columns join together.
    const rowBuckets = new Map<number, string[]>();
    const hasNumericRows = lines.some((item) => typeof item.row === "number");

    if (hasNumericRows) {
      for (const item of lines) {
        if (typeof item.row === "number") {
          const bucket = rowBuckets.get(item.row) ?? [];
          bucket.push(item.text);
          rowBuckets.set(item.row, bucket);
        }
      }
      const orderedRows = Array.from(rowBuckets.entries()).sort((a, b) => a[0] - b[0]);
      for (const [, parts] of orderedRows) {
        pushUnique(parts.join(" "));
      }
    }

    for (const item of lines) {
      pushUnique(item.text);
    }
  }

  for (const line of rawText.split(/\r?\n/)) {
    pushUnique(line);
  }

  return result;
}

function looksLikeDottedTime(
  line: string,
  matchIndex: number,
  matchText: string,
  rawNumeric: string
): boolean {
  const after = line.slice(matchIndex + matchText.length);
  const before = line.slice(0, matchIndex);

  if (/^\s*(?:น\.?|นาที|am|pm|hrs?)\b/iu.test(after)) {
    return true;
  }

  const [whole, frac] = rawNumeric.split(".");
  const hour = Number(whole);
  const minute = Number(frac);
  const isClockRange =
    whole.length <= 2 &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59;

  if (!isClockRange) {
    return false;
  }

  // Only treat HH.MM as time if line mentions time/date without explicit currency or amount label.
  const hasMoneySignal =
    CURRENCY_MARKER_REGEX.test(line) || AMOUNT_LABEL_REGEX.test(line);
  const hasDateTimeSignal =
    /เวลา|time/iu.test(before) ||
    MONTH_NAME_REGEX.test(line) ||
    TIMESTAMP_CONTEXT_REGEX.test(line);

  return !hasMoneySignal && hasDateTimeSignal;
}

function extractAmount(searchLines: string[]): string | null {
  const moneyPattern =
    /(?:฿|thb|บาท)?\s*((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})(?!\d)\s*(?:บาท|thb|฿)?/giu;

  interface Candidate {
    formatted: string;
    score: number;
    value: number;
  }

  const candidates: Candidate[] = [];

  for (const line of searchLines) {
    const isFeeLine = FEE_LABEL_REGEX.test(line);
    const hasAmountLabel = AMOUNT_LABEL_REGEX.test(line);
    const hasCurrencyOnLine = CURRENCY_MARKER_REGEX.test(line);

    let match: RegExpExecArray | null;
    moneyPattern.lastIndex = 0;

    while ((match = moneyPattern.exec(line)) !== null) {
      const numericToken = match[1].replace(/,/g, "");
      if (looksLikeDottedTime(line, match.index, match[0], numericToken)) {
        continue;
      }

      const decimal = toDecimal(numericToken);
      const numericValue = decimal.toNumber();
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        continue;
      }
      if (isFeeLine && numericValue === 0) {
        continue;
      }

      let score = 10;
      if (hasAmountLabel) score += 35;
      if (hasCurrencyOnLine || CURRENCY_MARKER_REGEX.test(match[0])) score += 15;
      if (isFeeLine) score -= 45;

      candidates.push({
        formatted: decimal.toFixed(2),
        score,
        value: numericValue,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.value - a.value;
  });

  return candidates[0].formatted;
}

function normalizeYear(rawYear: number, preferBuddhistEra: boolean): number | null {
  if (rawYear >= 2400 && rawYear <= 2650) {
    return rawYear - 543;
  }
  if (rawYear >= 1990 && rawYear <= 2150) {
    return rawYear;
  }
  if (rawYear >= 0 && rawYear <= 99) {
    if (preferBuddhistEra || rawYear >= 45) {
      return 2500 + rawYear - 543;
    }
    return 2000 + rawYear;
  }
  return null;
}

function toIsoDate(year: number | null, month: number, day: number): string | null {
  if (!year || year < 2000 || year > 2100) {
    return null;
  }
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidIsoCalendarDate(iso) ? iso : null;
}

function extractTransactionDate(searchLines: string[]): string | null {
  for (const line of searchLines) {
    // 1. Thai date: "19 พ.ย. 2569", "19 พ.ย. 69", "19 พฤศจิกายน 2569"
    for (const [monthRegex, monthNumber] of THAI_MONTH_MAP) {
      const pattern = new RegExp(
        `(\\d{1,2})\\s*(?:${monthRegex.source})\\s*,?\\s*(\\d{2,4})`,
        "iu"
      );
      const match = line.match(pattern);
      if (match) {
        const day = Number(match[1]);
        const rawYear = Number(match[2]);
        const iso = toIsoDate(normalizeYear(rawYear, true), monthNumber, day);
        if (iso) return iso;
      }
    }

    // 2. English date: "19 Nov 2026", "19 Nov 26", "19 November, 2026"
    const enMatch = line.match(
      /(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*,?\s*(\d{2,4})/i
    );
    if (enMatch) {
      const day = Number(enMatch[1]);
      const monthNumber = EN_MONTH_MAP[enMatch[2].toLowerCase()];
      const rawYear = Number(enMatch[3]);
      if (monthNumber) {
        const iso = toIsoDate(normalizeYear(rawYear, false), monthNumber, day);
        if (iso) return iso;
      }
    }

    // 3. ISO YYYY-MM-DD (prefer lines mentioning date/time or general slip header)
    const isoMatch = line.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const rawYear = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      const iso = toIsoDate(normalizeYear(rawYear, rawYear >= 2400), month, day);
      if (iso) return iso;
    }

    // 4. Slash/dash DD/MM/YYYY or DD/MM/YY
    const slashMatch = line.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (slashMatch) {
      const day = Number(slashMatch[1]);
      const month = Number(slashMatch[2]);
      const rawYear = Number(slashMatch[3]);
      const iso = toIsoDate(
        normalizeYear(rawYear, rawYear >= 2400),
        month,
        day
      );
      if (iso) return iso;
    }
  }

  return null;
}

function detectBankInText(text: string): string | null {
  for (const [matcher, label] of BANK_MATCHERS) {
    if (matcher.test(text)) {
      return label;
    }
  }
  return null;
}

function detectBankHint(searchLines: string[]): string | null {
  for (const line of searchLines) {
    const found = detectBankInText(line);
    if (found) {
      return found;
    }
  }
  return null;
}

function cleanRecipientCandidate(raw: string): string | null {
  let stripped = raw
    .replace(
      /^(?:ไปยัง|ถึง|ผู้รับเงิน|ผู้รับ|บัญชีผู้รับ|เข้าบัญชี|ชื่อบัญชี|ร้านค้า|(?:to|recipient|merchant)(?=\s*[:：-]|\s+|$))\s*[:：-]?\s*/iu,
      ""
    )
    .replace(/[xX*]{2,}[-\s\dxX*]*\d[xX*\d-]*/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  // Remove trailing bank label if it appeared inline after the recipient name
  for (const [bankPattern] of BANK_MATCHERS) {
    const trailingBank = new RegExp(`\\s+(?:${bankPattern.source})$`, "iu");
    stripped = stripped.replace(trailingBank, "").trim();
  }

  if (!stripped || stripped.length < 2) {
    return null;
  }
  // Ignore lines that are purely bank codes, phone/account masks, or reference numbers.
  if (/^[\d\sxX*-]+$/.test(stripped)) {
    return null;
  }
  if (/^(?:รหัสอ้างอิง|เลขที่รายการ|ref\.?\s*no\.?|transaction\s*id)/iu.test(stripped)) {
    return null;
  }
  return stripped.slice(0, 120);
}

function extractAccountMaskFromLine(line: string): string | null {
  const maskedMatch = line.match(
    /[xX*]{2,}(?:[-\s]*[\dxX*]){2,}[-\s]*\d[xX*\d-]*/u
  );
  if (maskedMatch) {
    return maskAccountNumber(maskedMatch[0]);
  }

  if (/\d\.\d{2}\b/.test(line)) {
    return null;
  }
  if (/^(?:รหัสอ้างอิง|เลขที่รายการ|ref\.?\s*no\.?|transaction\s*id)/iu.test(line)) {
    return null;
  }

  const formattedNumberMatch = line.match(
    /(?<!\d)(?:\d{3}[-\s]\d{1,3}[-\s]\d{3,5}(?:[-\s]\d{1,2})?|\d{10,12})(?!\d)/u
  );
  if (formattedNumberMatch) {
    return maskAccountNumber(formattedNumberMatch[0]);
  }

  return null;
}

function extractRecipientDetails(searchLines: string[]): {
  recipientName: string | null;
  recipientBank: string | null;
  recipientAccount: string | null;
} {
  const inlinePrefixRegex =
    /^(?:ไปยัง|ผู้รับเงิน|ผู้รับ|เข้าบัญชี|บัญชีผู้รับ|ร้านค้า|(?:to|recipient|merchant)(?=\s*[:：-]|\s+))\s*[:：-]?\s*(.+)$/iu;
  const labelOnlyRegex =
    /^(?:ไปยัง|ผู้รับเงิน|ผู้รับ|เข้าบัญชี|บัญชีผู้รับ|\bto\b|\brecipient\b)\s*[:：-]?$/iu;
  const senderPrefixRegex = /^(?:จาก|ผู้โอน|from)\b/iu;
  const stopSectionRegex =
    /^(?:จำนวนเงิน|จำนวน|ยอดโอน|ยอดชำระ|ค่าธรรมเนียม|รหัสอ้างอิง|เลขที่รายการ|บันทึกช่วยจำ|หมายเหตุ|amount|fee|charge|ref\.?\s*no\.?|memo|note)\b/iu;

  let anchorIdx = -1;
  let recipientName: string | null = null;

  for (let i = 0; i < searchLines.length; i++) {
    const line = searchLines[i];
    if (senderPrefixRegex.test(line)) {
      continue;
    }

    const inlineMatch = line.match(inlinePrefixRegex);
    if (inlineMatch) {
      const cleaned = cleanRecipientCandidate(inlineMatch[1]);
      if (cleaned) {
        anchorIdx = i;
        recipientName = cleaned;
        break;
      }
    }

    if (labelOnlyRegex.test(line) && i + 1 < searchLines.length) {
      const next = cleanRecipientCandidate(searchLines[i + 1]);
      if (next) {
        anchorIdx = i;
        recipientName = next;
        break;
      }
    }
  }

  if (anchorIdx < 0) {
    return {
      recipientName: null,
      recipientBank: null,
      recipientAccount: null,
    };
  }

  let recipientBank: string | null = null;
  let recipientAccount: string | null = null;

  const maxLookahead = Math.min(searchLines.length - 1, anchorIdx + 3);
  for (let j = anchorIdx; j <= maxLookahead; j++) {
    const candidateLine = searchLines[j];
    if (j > anchorIdx && stopSectionRegex.test(candidateLine)) {
      break;
    }

    if (!recipientBank) {
      recipientBank = detectBankInText(candidateLine);
    }
    if (!recipientAccount) {
      recipientAccount = extractAccountMaskFromLine(candidateLine);
    }

    if (recipientBank && recipientAccount) {
      break;
    }
  }

  return {
    recipientName,
    recipientBank,
    recipientAccount,
  };
}

function extractMemo(searchLines: string[]): string | null {
  const inlineMemoRegex = /^(?:บันทึกช่วยจำ|หมายเหตุ|memo|note)\s*[:：-]?\s*(.+)$/iu;
  const labelOnlyMemoRegex = /^(?:บันทึกช่วยจำ|หมายเหตุ|memo|note)\s*[:：-]?$/iu;
  const footerNoiseRegex = /^(?:ผู้รับเงินสามารถ|สามารถสแกน|verify|scan\s*qr)/iu;

  for (let i = 0; i < searchLines.length; i++) {
    const line = searchLines[i];
    const inline = line.match(inlineMemoRegex);
    if (inline) {
      const candidate = cleanSpaces(inline[1]);
      if (candidate && !footerNoiseRegex.test(candidate)) {
        return candidate.slice(0, 60);
      }
    }
    if (labelOnlyMemoRegex.test(line) && i + 1 < searchLines.length) {
      const next = cleanSpaces(searchLines[i + 1]);
      if (next && !footerNoiseRegex.test(next)) {
        return next.slice(0, 60);
      }
    }
  }
  return null;
}

const WALLET_BANK_ALIAS_MAP: Record<string, RegExp[]> = {
  SCB: [/\bscb\b|ไทยพาณิชย์/i],
  "K PLUS": [/k\s*plus|\bkbank\b|กสิกร/i],
  Krungthai: [/krungthai|\bktb\b|กรุงไทย/i],
  BBL: [/\bbbl\b|bangkok|กรุงเทพ|บัวหลวง/i],
  Krungsri: [/krungsri|\bbay\b|กรุงศรี/i],
  ttb: [/\bttb\b|ทหารไทย|ธนชาต/i],
  GSB: [/\bgsb\b|mymo|ออมสิน/i],
  PromptPay: [/prompt\s*pay|พร้อมเพย์|truemoney|ทรูมันนี่|e-?wallet/i],
};

export interface SlipWalletCandidate {
  id: string;
  name: string;
  type: WalletType;
  isArchived?: boolean;
}

/**
 * Select the most appropriate non-cash wallet for an e-slip.
 * Returns null when keeping the existing wallet is already best.
 */
export function pickSlipWalletId(
  wallets: SlipWalletCandidate[],
  currentWalletId: string,
  bankHint: string | null
): string | null {
  const active = wallets.filter((w) => !w.isArchived);
  if (active.length === 0) return null;

  const nonCashAccounts = active.filter(
    (w) => w.type === "bank" || w.type === "ewallet"
  );

  // 1. Prefer matching detected bank name against active bank/e-wallet accounts.
  if (bankHint && WALLET_BANK_ALIAS_MAP[bankHint]) {
    const patterns = WALLET_BANK_ALIAS_MAP[bankHint];
    const bankNamedMatch = nonCashAccounts.find((w) =>
      patterns.some((pattern) => pattern.test(w.name))
    );
    if (bankNamedMatch) {
      return bankNamedMatch.id;
    }
  }

  const currentWallet = active.find((w) => w.id === currentWalletId);
  if (
    currentWallet &&
    (currentWallet.type === "bank" || currentWallet.type === "ewallet")
  ) {
    return null;
  }

  // 2. If currently on Cash (or empty/savings), switch to first active Bank, then e-Wallet.
  const firstBank = active.find((w) => w.type === "bank");
  if (firstBank) return firstBank.id;

  const firstEwallet = active.find((w) => w.type === "ewallet");
  if (firstEwallet) return firstEwallet.id;

  const firstCard = active.find((w) => w.type === "credit_card");
  if (firstCard && currentWallet?.type === "cash") return firstCard.id;

  return null;
}

function computeConfidence(
  lines: OcrLineItem[] | undefined,
  hasAmount: boolean,
  hasDate: boolean
): number {
  const scored = (lines ?? [])
    .map((line) => line.confidence)
    .filter((val): val is number => typeof val === "number" && Number.isFinite(val));

  const ocrAvg =
    scored.length > 0
      ? scored.reduce((sum, val) => sum + val, 0) / scored.length
      : 0.85;

  const parseScore = (hasAmount ? 0.65 : 0) + (hasDate ? 0.25 : 0) + 0.1;
  const blended = ocrAvg * 0.4 + parseScore * 0.6;
  return Number(Math.max(0, Math.min(1, blended)).toFixed(2));
}

function extractTransactionTime(searchLines: string[]): string | null {
  for (const line of searchLines) {
    // Match "14:35", "14:35:20", "14.35 น.", "14:35 น."
    const match = line.match(
      /(?:^|[^\d])([01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?(?:\s*น\.?)?(?:$|[^\d])/u
    );
    if (match) {
      const hh = String(Number(match[1])).padStart(2, "0");
      const mm = match[2];
      const formatted = `${hh}:${mm}`;
      if (isValidTime24(formatted)) {
        return formatted;
      }
    }
  }
  return null;
}

export function parseThaiBankSlip(
  rawText: string,
  lines?: OcrLineItem[]
): ParsedSlipResult {
  const searchLines = buildSearchLines(rawText, lines);
  const amount = extractAmount(searchLines);
  const transactionDate = extractTransactionDate(searchLines);
  const transactionTime = extractTransactionTime(searchLines);
  const bankHint = detectBankHint(searchLines);
  const { recipientName, recipientBank, recipientAccount } =
    extractRecipientDetails(searchLines);
  const memo = extractMemo(searchLines);

  const labelPart = [memo, recipientName].filter(Boolean).join(" · ");
  let suggestedNote: string | null = null;
  if (labelPart && bankHint) {
    suggestedNote = `${labelPart} (${bankHint})`;
  } else if (labelPart) {
    suggestedNote = labelPart;
  } else if (bankHint) {
    suggestedNote = `สลิปโอนเงิน (${bankHint})`;
  }

  const warnings: string[] = [];
  if (!amount) {
    warnings.push("ไม่พบยอดเงินอัตโนมัติ กรุณากรอกยอดเงินด้วยตัวเอง");
  }
  if (!transactionDate) {
    warnings.push("ไม่พบวันที่ในสลิป ระบบคงวันที่เดิมไว้");
  }

  return {
    amount,
    transactionDate,
    transactionTime,
    suggestedNote,
    bankHint,
    recipientName,
    recipientBank,
    recipientAccount,
    confidence: computeConfidence(lines, Boolean(amount), Boolean(transactionDate)),
    warnings,
  };
}
