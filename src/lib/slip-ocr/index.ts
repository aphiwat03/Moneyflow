import { geminiMockOcrProvider } from "./gemini-mock-provider";
import { localOpenThaiOcrProvider } from "./local-provider";
import type { SlipOcrProvider, SlipOcrProviderName } from "./types";

export * from "./types";

export function resolveSlipOcrProviderName(
  requested?: string | null
): SlipOcrProviderName {
  if (requested === "gemini" || requested === "local") {
    return requested;
  }
  return process.env.SLIP_OCR_PROVIDER === "gemini" ? "gemini" : "local";
}

export function getSlipOcrProvider(
  name: SlipOcrProviderName
): SlipOcrProvider {
  return name === "gemini" ? geminiMockOcrProvider : localOpenThaiOcrProvider;
}
