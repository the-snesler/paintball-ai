import { useCallback } from "react";
import { useGenerationStore } from "~/stores/generationStore";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { saveImage, toDisplayImage } from "~/lib/db";
import { getModel, MODELS } from "~/lib/models";
import type { ApiKeys, PendingGeneration } from "~/types";
import { GoogleGenAI } from "@google/genai";

interface GenerationTask {
  id: string;
  modelId: string;
  modelName: string;
  prompt: string;
  aspectRatio: string;
  resolution: string | null;
  referenceImages: Array<{ blob: Blob }>;
}

export function useImageGeneration() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const addImage = useGalleryStore((s) => s.addImage);

  const prompt = useGenerationStore((s) => s.prompt);
  const modelSelections = useGenerationStore((s) => s.modelSelections);
  const aspectRatio = useGenerationStore((s) => s.aspectRatio);
  const resolution = useGenerationStore((s) => s.resolution);
  const referenceImages = useGenerationStore((s) => s.referenceImages);
  const startGeneration = useGenerationStore((s) => s.startGeneration);
  const updatePendingGeneration = useGenerationStore((s) => s.updatePendingGeneration);
  const completeGeneration = useGenerationStore((s) => s.completeGeneration);

  const generate = useCallback(async () => {
    // Build tasks for each model/count
    const tasks: GenerationTask[] = [];
    const pending: PendingGeneration[] = [];

    for (const [modelId, count] of Object.entries(modelSelections)) {
      if (count === 0) continue;

      const model = getModel(modelId);
      if (!model) continue;

      for (let i = 0; i < count; i++) {
        const taskId = crypto.randomUUID();
        tasks.push({
          id: taskId,
          modelId,
          modelName: model.name,
          prompt,
          aspectRatio,
          resolution: model.capabilities.supportsResolution ? resolution : null,
          referenceImages: referenceImages.map((r) => ({ blob: r.blob })),
        });
        pending.push({
          id: taskId,
          modelId,
          modelName: model.name,
          status: "pending",
        });
      }
    }

    if (tasks.length === 0) return;

    // Start generation
    startGeneration(pending);

    // Execute all tasks in parallel
    const results = await Promise.allSettled(
      tasks.map(async (task) => {
        updatePendingGeneration(task.id, { status: "generating" });

        try {
          const result = await executeGeneration(task, apiKeys);

          // Save to IndexedDB
          const storedImage = await saveImage({
            blob: result.blob,
            prompt: task.prompt,
            modelId: task.modelId,
            modelName: task.modelName,
            aspectRatio: task.aspectRatio,
            resolution: task.resolution,
            width: result.width,
            height: result.height,
            createdAt: Date.now(),
            referenceImageIds: [],
            metadata: result.metadata,
          });

          // Add to gallery
          addImage(toDisplayImage(storedImage));

          updatePendingGeneration(task.id, { status: "completed" });

          return storedImage;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Generation failed";
          updatePendingGeneration(task.id, { status: "failed", error: message });
          throw error;
        }
      })
    );

    // Complete generation
    setTimeout(() => {
      completeGeneration();
    }, 1000);

    return results;
  }, [
    prompt,
    modelSelections,
    aspectRatio,
    resolution,
    referenceImages,
    apiKeys,
    startGeneration,
    updatePendingGeneration,
    completeGeneration,
    addImage,
  ]);

  return { generate };
}

async function executeGeneration(
  task: GenerationTask,
  apiKeys: ApiKeys
): Promise<{ blob: Blob; width: number; height: number; metadata: Record<string, unknown> }> {
  const model = getModel(task.modelId);
  if (!model) throw new Error("Model not found");

  const apiKey = apiKeys[model.apiKeyRequired];
  if (!apiKey) throw new Error(`No API key for ${model.provider}`);

  // For Google models, use direct API call
  if (model.provider === "google") {
    return executeGoogleGeneration(task, apiKey);
  }

  throw new Error(`Provider ${model.provider} not implemented`);
}

async function executeGoogleGeneration(
  task: GenerationTask,
  apiKey: string
): Promise<{ blob: Blob; width: number; height: number; metadata: Record<string, unknown> }> {
  const ai = new GoogleGenAI({ apiKey });

  // Build parts array
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  // Add reference images if any
  for (const ref of task.referenceImages) {
    const base64 = await blobToBase64(ref.blob);
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: base64.split(",")[1], // Remove data:image/png;base64, prefix
      },
    });
  }

  // Add the prompt
  parts.push({ text: task.prompt });

  const contents = [
    {
      role: "user",
      parts,
    },
  ];

  const config = {
    responseModalities: ["IMAGE"],
    imageConfig: {
      aspectRatio: task.aspectRatio,
      ...(task.resolution && { imageSize: task.resolution }),
    },
  };

  const response = await ai.models.generateContentStream({
    model: task.modelId,
    config,
    contents,
  });

  let imageBlob: Blob | null = null;
  let modelVersion: string | undefined;

  for await (const chunk of response) {
    if (!chunk.candidates?.[0]?.content?.parts) {
      continue;
    }

    const inlineData = chunk.candidates[0].content.parts[0]?.inlineData;
    if (inlineData?.data && inlineData?.mimeType) {
      // Convert base64 to blob
      const binaryString = atob(inlineData.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageBlob = new Blob([bytes], { type: inlineData.mimeType });
    }

    if (chunk.modelVersion) {
      modelVersion = chunk.modelVersion;
    }
  }

  if (!imageBlob) {
    throw new Error("No image in response");
  }

  // Get dimensions from the image
  const dimensions = await getImageDimensions(imageBlob);

  return {
    blob: imageBlob,
    width: dimensions.width,
    height: dimensions.height,
    metadata: {
      modelVersion,
    },
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      resolve({ width: 1024, height: 1024 });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(blob);
  });
}
