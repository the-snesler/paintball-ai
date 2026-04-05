import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import Replicate from "replicate";
import { useSettingsStore } from "~/stores/settingsStore";
import type { Provider } from "~/types";
import { blobToBase64 } from "./util";

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

export async function callTextModel(
  systemPrompt: string,
  userPrompt: string,
  images?: Blob[],
): Promise<string> {
  const { provider, apiKey, modelId } = resolveProvider();

  if (provider === "google") {
    return callGoogleTextModel(apiKey, modelId, systemPrompt, userPrompt, images);
  }

  return callReplicateTextModel(apiKey, modelId, systemPrompt, userPrompt);
}

async function callGoogleTextModel(
  apiKey: string,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  images?: Blob[],
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

  const response = await ai.models.generateContent({
    model: modelId,
    config: {
      systemInstruction: systemPrompt,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.LOW,
      },
    },
    contents: [{ role: "user", parts }],
  });

  const text = response.text;
  if (!text) {
    throw new Error("No text in response");
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

  const output = await replicate.run(
    modelId as `${string}/${string}`,
    { input: { prompt: userPrompt, system_prompt: systemPrompt } }
  );

  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output)) {
    return output.join("");
  }

  throw new Error("Unexpected text model response format");
}
