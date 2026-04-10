import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import Replicate from "replicate";
import { useSettingsStore } from "~/stores/settingsStore";
import type { Provider } from "~/types";
import { blobToBase64 } from "./util";
import { logger } from "./logging";
import { retryWithBackoff, toRateLimitError } from "./retry";

const DEFAULT_GOOGLE_MODEL = "gemini-3-flash-preview";
const DEFAULT_REPLICATE_MODEL = "google/gemini-3-flash";

interface ResolvedProvider {
  provider: Provider;
  apiKey: string;
  modelId: string;
}

function resolveProvider(): ResolvedProvider {
  const { apiKeys, textModel } = useSettingsStore.getState();

  // Try configured provider first
  if (apiKeys[textModel.provider]) {
    return {
      provider: textModel.provider,
      apiKey: apiKeys[textModel.provider]!,
      modelId: textModel.modelId,
    };
  }

  // Fallback to the other provider
  const fallback: Provider = textModel.provider === "google" ? "replicate" : "google";
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
 * branch on capability (e.g. only use response prefill on the Google path).
 */
export function resolveTextModelProvider(): Provider | null {
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

  const output = await retryWithBackoff(() => {
    let output = "";
    if (provider === "google") {
      return callGoogleTextModel(apiKey, modelId, systemPrompt, userPrompt, images, prefill);
    }
    return callReplicateTextModel(apiKey, modelId, systemPrompt, userPrompt);
  });

  logger.debug("Text model output:", output);
  return output;
}

async function callGoogleTextModel(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  images?: Blob[],
  prefill?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  if (images?.length) {
    for (const blob of images) {
      const base64 = await blobToBase64(blob);
      parts.push({
        inlineData: {
          mimeType: blob.type || "image/png",
          data: base64.split(",")[1],
        },
      });
    }
  }

  parts.push({ text: userPrompt });

  const contents: Array<{
    role: "user" | "model";
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
  }> = [{ role: "user", parts }];

  if (prefill) {
    contents.push({ role: "model", parts: [{ text: prefill }] });
  }

  let response;
  try {
    response = await ai.models.generateContent({
      model: modelId,
      config: {
        systemInstruction: systemPrompt,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
      contents,
    });
  } catch (error) {
    throw toRateLimitError(error, "google");
  }

  const text = response.text;
  if (!text) {
    throw new Error("No text in response");
  }

  if (prefill) {
    logger.debug(
      "Google text model response with prefill. prefill=",
      prefill,
      "response.text=",
      text
    );
    return prefill + text;
  }

  return text;
}

async function callReplicateTextModel(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const baseUrl = new URL("/proxy/replicate/v1", window.location.origin).toString();
  const replicate = new Replicate({ auth: apiKey, baseUrl });

  let output;
  try {
    output = await replicate.run(modelId as `${string}/${string}`, {
      input: { prompt: userPrompt, system_prompt: systemPrompt },
    });
  } catch (error) {
    throw toRateLimitError(error, "replicate");
  }

  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    return output.join("");
  }

  throw new Error("Unexpected text model response format");
}
