import { useSettingsStore } from "~/stores/settingsStore";
import type { ApiKeyProvider } from "~/types";
import { getProvider } from "~/lib/providers";
import { logger } from "./logging";
import { retryWithBackoff } from "./retry";

const DEFAULT_GOOGLE_MODEL = "gemini-3-flash-preview";
const DEFAULT_REPLICATE_MODEL = "google/gemini-3-flash";

interface ResolvedProvider {
  provider: ApiKeyProvider;
  apiKey: string;
  modelId: string;
}

function resolveProvider(): ResolvedProvider {
  const { apiKeys, textModels } = useSettingsStore.getState();
  const selected = textModels.find((m) => m.enabled) ?? textModels[0];

  if (!selected) {
    throw new Error("No text model configured");
  }

  if (apiKeys[selected.provider]) {
    return {
      provider: selected.provider,
      apiKey: apiKeys[selected.provider]!,
      modelId: selected.modelId,
    };
  }

  const fallback: ApiKeyProvider = selected.provider === "google" ? "replicate" : "google";
  if (apiKeys[fallback]) {
    return {
      provider: fallback,
      apiKey: apiKeys[fallback]!,
      modelId: fallback === "google" ? DEFAULT_GOOGLE_MODEL : DEFAULT_REPLICATE_MODEL,
    };
  }

  throw new Error("No API key available for text model");
}

export function isTextModelAvailable(): boolean {
  const { apiKeys } = useSettingsStore.getState();
  return !!(apiKeys.google || apiKeys.replicate);
}

/**
 * Returns the provider that would be used for the next `callTextModel` call,
 * or null if no API keys are available. Useful for call sites that want to
 * branch on capability.
 */
export function resolveTextModelProvider(): ApiKeyProvider | null {
  try {
    return resolveProvider().provider;
  } catch {
    return null;
  }
}

export async function callTextModel(
  systemPrompt: string,
  userPrompt: string,
  images?: Blob[],
  prefill?: string
): Promise<string> {
  const { provider, apiKey, modelId } = resolveProvider();
  logger.debug(
    `Text model called with ${images?.length ?? 0} images. Prompts:`,
    `\nSystem: ${systemPrompt}`,
    `\nUser: ${userPrompt}`,
    `\nPrefill: ${prefill ?? "none"}`
  );

  const impl = getProvider(provider).generateText;
  if (!impl) {
    throw new Error(`Provider ${provider} does not support text generation`);
  }

  const output = await retryWithBackoff(() =>
    impl({ modelId, systemPrompt, userPrompt, images, prefill }, apiKey)
  );

  logger.debug("Text model output:", output);
  return output;
}

/**
 * Validate that a text model can be called end-to-end. Used when adding a
 * custom model so we fail fast on bad IDs or wrong providers. Bypasses the
 * store and does NOT retry — a single fast attempt is what users expect here.
 */
export async function testTextModel(
  provider: ApiKeyProvider,
  apiKey: string,
  modelId: string
): Promise<void> {
  const impl = getProvider(provider).testTextModel;
  if (!impl) {
    throw new Error(`Provider ${provider} does not support text generation`);
  }
  await impl(apiKey, modelId);
}
