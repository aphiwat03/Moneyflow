export type SlipOcrProviderName = "local" | "gemini";

export interface SlipOcrScanRequest {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  signal?: AbortSignal;
}

export interface SlipOcrScanResponse {
  provider: SlipOcrProviderName;
  isMock: boolean;
  model: string;
  durationMs: number;
  rawText: string;
  amount: string | null;
  transactionDate: string | null;
  suggestedNote: string | null;
  bankHint: string | null;
  confidence: number;
  warnings: string[];
}

export interface SlipOcrProvider {
  readonly name: SlipOcrProviderName;
  scan(request: SlipOcrScanRequest): Promise<SlipOcrScanResponse>;
}

export class SlipOcrProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 502
  ) {
    super(message);
    this.name = "SlipOcrProviderError";
  }
}
