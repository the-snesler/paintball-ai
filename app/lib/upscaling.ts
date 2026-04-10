import Replicate from "replicate";
import { blobToBase64 } from "./util";
import { getImageDimensions } from "./imageProcessing";
import type { GenerationResult } from "./generation";

export interface UpscalerOption {
  id: string;
  label: string;
  scale: number | null;
  scaleParam: string | null;
}

export const UPSCALERS: UpscalerOption[] = [
  { id: "nightmareai/real-esrgan", label: "Real-ESRGAN 2x", scale: 2, scaleParam: "scale" },
  { id: "nightmareai/real-esrgan", label: "Real-ESRGAN 4x", scale: 4, scaleParam: "scale" },
  { id: "zsxkib/aura-sr-v2", label: "AuraSR 4x", scale: null, scaleParam: null },
  { id: "philz1337x/clarity-upscaler", label: "Clarity", scale: null, scaleParam: null },
];

export async function executeUpscale(
  sourceBlob: Blob,
  upscaler: UpscalerOption,
  apiKey: string
): Promise<GenerationResult> {
  const baseUrl = new URL("/proxy/replicate/v1", window.location.origin).toString();
  const replicate = new Replicate({ auth: apiKey, baseUrl });

  const dataUri = await blobToBase64(sourceBlob);

  const input: Record<string, unknown> = { image: dataUri };
  if (upscaler.scaleParam !== null && upscaler.scale !== null) {
    input[upscaler.scaleParam] = upscaler.scale;
  }

  let output;
  try {
    output = await replicate.run(upscaler.id as `${string}/${string}`, { input });
  } catch (error) {
    throw error;
  }

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
