import { useCallback, useState } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { saveImage } from "~/lib/db";
import { createThumbnailBlob } from "~/lib/imageProcessing";
import { executeUpscale, type UpscalerOption } from "~/lib/upscaling";
import type { CompletedGalleryItem } from "~/types";

export type UpscaleStatus = "idle" | "running" | "done" | "error";

export function useUpscale(): {
  status: UpscaleStatus;
  error: string | null;
  upscale: (source: CompletedGalleryItem, upscaler: UpscalerOption) => Promise<void>;
} {
  const [status, setStatus] = useState<UpscaleStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const apiKey = useSettingsStore((s) => s.apiKeys.replicate);
  const addItems = useGalleryStore((s) => s.addItems);
  const updateItem = useGalleryStore((s) => s.updateItem);

  const upscale = useCallback(
    async (source: CompletedGalleryItem, upscaler: UpscalerOption) => {
      if (!apiKey) return;

      setStatus("running");
      setError(null);

      const newId = crypto.randomUUID();

      addItems([
        {
          id: newId,
          status: "generating",
          modelId: source.modelId,
          modelName: `${upscaler.label} ↑`,
          prompt: source.prompt,
          basePrompt: source.basePrompt,
          variationReplacements: source.variationReplacements,
          aspectRatio: source.aspectRatio,
          resolution: source.resolution,
          referenceImageIds: [],
        },
      ]);

      try {
        const result = await executeUpscale(source.originalBlob, upscaler, apiKey);

        const thumbnailBlob = await createThumbnailBlob(result.blob, 400);
        const createdAt = Date.now();
        const metadata = {
          upscaledFrom: source.id,
          upscaler: upscaler.id,
          upscaleLabel: upscaler.label,
        };

        await saveImage({
          id: newId,
          originalBlob: result.blob,
          thumbnailBlob,
          prompt: source.prompt,
          basePrompt: source.basePrompt,
          variationReplacements: source.variationReplacements,
          modelId: source.modelId,
          modelName: `${upscaler.label} ↑`,
          aspectRatio: source.aspectRatio,
          resolution: source.resolution,
          width: result.width,
          height: result.height,
          createdAt,
          referenceImageIds: [],
          metadata,
        });

        updateItem(newId, {
          status: "completed",
          originalBlob: result.blob,
          originalUrl: URL.createObjectURL(result.blob),
          thumbnailBlob,
          thumbnailUrl: URL.createObjectURL(thumbnailBlob),
          width: result.width,
          height: result.height,
          createdAt,
          metadata,
        });

        setStatus("done");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upscale failed";
        updateItem(newId, { status: "failed", error: message, canRetry: false });
        setError(message);
        setStatus("error");
      }
    },
    [apiKey, addItems, updateItem]
  );

  return { status, error, upscale };
}
