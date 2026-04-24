import { getProvider } from "~/lib/providers";
import type { GenerationResult } from "./generation";
import type { StoredUpscaler } from "~/types";

export async function executeUpscale(
  sourceBlob: Blob,
  upscaler: StoredUpscaler,
  apiKey: string
): Promise<GenerationResult> {
  // Upscalers are Replicate-only today; keep the lookup indirect so adding
  // another provider's upscaler later is just a matter of extending the upscaler
  // record with a provider field.
  const provider = getProvider("replicate");
  if (!provider.upscale) {
    throw new Error("Replicate provider does not support upscaling");
  }
  return provider.upscale(sourceBlob, upscaler, apiKey);
}
