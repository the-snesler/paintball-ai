import { useCallback } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { saveImage } from "~/lib/db";
import { getModel } from "~/lib/models";
import type { ApiKeys, AspectRatio, GalleryItem, Resolution } from "~/types";
import { GoogleGenAI } from "@google/genai";
import Replicate from "replicate";

interface GenerationTask {
  id: string;
  modelId: string;
  modelName: string;
  prompt: string;
  aspectRatio: AspectRatio;
  resolution: Resolution | null;
  referenceImages: Array<{ blob: Blob }>;
}

export function useImageGeneration() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);

  const prompt = useGalleryStore((s) => s.currentPrompt);
  const modelSelections = useGalleryStore((s) => s.currentModelSelections);
  const aspectRatio = useGalleryStore((s) => s.currentAspectRatio);
  const resolution = useGalleryStore((s) => s.currentResolution);
  const referenceImages = useGalleryStore((s) => s.currentReferenceImages);
  const addItems = useGalleryStore((s) => s.addItems);
  const updateItem = useGalleryStore((s) => s.updateItem);
  const setGenerating = useGalleryStore((s) => s.setGenerating);

  const generate = useCallback(async () => {
    // Build tasks for each model/count
    const tasks: GenerationTask[] = [];
    const pendingItems: GalleryItem[] = [];

    for (const [modelId, count] of Object.entries(modelSelections)) {
      if (count === 0) continue;

      const model = getModel(modelId);
      if (!model) continue;

      for (let i = 0; i < count; i++) {
        const taskId = crypto.randomUUID();
        const taskResolution = model.capabilities.supportsResolution ? resolution : null;

        tasks.push({
          id: taskId,
          modelId,
          modelName: model.name,
          prompt,
          aspectRatio,
          resolution: taskResolution,
          referenceImages: referenceImages.map((r) => ({ blob: r.blob })),
        });

        pendingItems.push({
          id: taskId,
          status: "pending",
          modelId,
          modelName: model.name,
          prompt,
          aspectRatio,
          resolution: taskResolution,
          referenceImageIds: referenceImages.map((r) => r.id),
        });
      }
    }

    if (tasks.length === 0) return;

    // Add pending items to gallery immediately
    addItems(pendingItems);
    setGenerating(true);

    // Execute all tasks in parallel
    const results = await Promise.allSettled(
      tasks.map(async (task) => {
        updateItem(task.id, { status: "generating" });

        try {
          const result = await executeGeneration(task, apiKeys);

          // Save to IndexedDB
          await saveImage({
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

          // Update item to completed status with image data
          updateItem(task.id, {
            status: "completed",
            blob: result.blob,
            url: URL.createObjectURL(result.blob),
            width: result.width,
            height: result.height,
            createdAt: Date.now(),
            metadata: result.metadata,
          });

          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Generation failed";
          updateItem(task.id, { status: "failed", error: message });
          throw error;
        }
      })
    );

    // Mark generation as complete
    setGenerating(false);

    return results;
  }, [
    prompt,
    modelSelections,
    aspectRatio,
    resolution,
    referenceImages,
    apiKeys,
    addItems,
    updateItem,
    setGenerating,
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

  // For Replicate models
  if (model.provider === "replicate") {
    return executeReplicateGeneration(task, apiKey);
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

async function executeReplicateGeneration(
  task: GenerationTask,
  apiKey: string
): Promise<{ blob: Blob; width: number; height: number; metadata: Record<string, unknown> }> {
  const replicate = new Replicate({ auth: apiKey, baseUrl: window.location.href + "proxy/replicate/v1" });

  // Convert reference image blobs to data URIs
  const imageInputs = await Promise.all(
    task.referenceImages.map(async (ref) => blobToBase64(ref.blob))
  );

  // Build input payload
  const input: Record<string, unknown> = {
    prompt: task.prompt,
    aspect_ratio: task.aspectRatio,
    output_format: "png",
  };
  if (imageInputs.length > 0) {
    input.image_input = imageInputs;
  }
  if (task.resolution) {
    input.resolution = task.resolution;
  }

  const replicateModel = task.modelId.replace("replicate/", "") as `${string}/${string}`;

  const output = await replicate.run(replicateModel, { input });

  // Get the image URL from the output
  const imageUrl = typeof output === "object" && output !== null && "url" in output
    ? (output as { url: () => string }).url()
    : Array.isArray(output)
      ? output[0]
      : String(output);

  if (!imageUrl) {
    throw new Error("No image in Replicate response");
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch generated image: ${imageResponse.status}`);
  }

  const blob = await imageResponse.blob();
  const dimensions = await getImageDimensions(blob);

  return {
    blob,
    width: dimensions.width,
    height: dimensions.height,
    metadata: {},
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
