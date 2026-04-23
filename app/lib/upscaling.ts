import Replicate from "replicate";
import { blobToBase64 } from "./util";
import { getImageDimensions } from "./imageProcessing";
import type { GenerationResult } from "./generation";
import type { StoredUpscaler } from "~/types";

export async function executeUpscale(
  sourceBlob: Blob,
  upscaler: StoredUpscaler,
  apiKey: string
): Promise<GenerationResult> {
  const baseUrl = new URL("/proxy/replicate/v1", window.location.origin).toString();
  const replicate = new Replicate({ auth: apiKey, baseUrl });

  const dataUri = await blobToBase64(sourceBlob);

  const input: Record<string, unknown> = { image: dataUri };
  if (upscaler.scaleParam !== null && upscaler.scale !== null) {
    input[upscaler.scaleParam] = upscaler.scale;
  }

  const output = await replicate.run(upscaler.replicateId as `${string}/${string}`, { input });

  const imageUrl =
    typeof output === "object" && output !== null && "url" in output
      ? (output as { url: () => string }).url()
      : Array.isArray(output)
        ? output[0]
        : String(output);

  if (!imageUrl) throw new Error("No image in upscale response");

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok)
    throw new Error(`Failed to fetch upscaled image: ${imageResponse.status}`);

  const blob = await imageResponse.blob();
  const dimensions = await getImageDimensions(blob);

  return { blob, width: dimensions.width, height: dimensions.height, metadata: {} };
}
