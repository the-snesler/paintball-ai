import JSZip from "jszip";
import type { StoredImageRecord } from "~/types";
import { getAllImages, getExistingImageIds, importImage } from "./db";
import { createThumbnailBlob } from "./imageProcessing";

interface ManifestEntry {
  id: string;
  prompt: string;
  modelId: string;
  modelName: string;
  aspectRatio: StoredImageRecord["aspectRatio"];
  resolution: StoredImageRecord["resolution"];
  width: number;
  height: number;
  createdAt: number;
  referenceImageIds: string[];
  metadata: Record<string, unknown>;
  filename: string;
}

function getBlobExtension(blob: Blob): string {
  const type = blob.type.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  return "png";
}

function extensionToMimeType(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "image/png";
  }
}

export async function exportAllImages(
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const images = await getAllImages();
  if (images.length === 0) return;

  const zip = new JSZip();
  const manifest: ManifestEntry[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const ext = getBlobExtension(image.originalBlob);
    const filename = `images/${image.id}.${ext}`;

    zip.file(filename, image.originalBlob);

    manifest.push({
      id: image.id,
      prompt: image.prompt,
      modelId: image.modelId,
      modelName: image.modelName,
      aspectRatio: image.aspectRatio,
      resolution: image.resolution,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt,
      referenceImageIds: image.referenceImageIds,
      metadata: image.metadata,
      filename,
    });

    onProgress?.(i + 1, images.length);
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `paintball-export-${date}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
}

export async function importFromZip(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(file);

  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("Invalid archive: missing manifest.json");
  }

  const manifestText = await manifestFile.async("text");
  const manifest: ManifestEntry[] = JSON.parse(manifestText);

  const existingIds = await getExistingImageIds();
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    onProgress?.(i + 1, manifest.length);

    if (existingIds.has(entry.id)) {
      result.skipped++;
      continue;
    }

    try {
      const imageFile = zip.file(entry.filename);
      if (!imageFile) {
        result.failed++;
        continue;
      }

      const ext = entry.filename.split(".").pop() || "png";
      const arrayBuffer = await imageFile.async("arraybuffer");
      const originalBlob = new Blob([arrayBuffer], { type: extensionToMimeType(ext) });
      const thumbnailBlob = await createThumbnailBlob(originalBlob, 400);

      const record: StoredImageRecord = {
        id: entry.id,
        originalBlob,
        thumbnailBlob,
        prompt: entry.prompt,
        modelId: entry.modelId,
        modelName: entry.modelName,
        aspectRatio: entry.aspectRatio,
        resolution: entry.resolution,
        width: entry.width,
        height: entry.height,
        createdAt: entry.createdAt,
        referenceImageIds: entry.referenceImageIds ?? [],
        metadata: entry.metadata ?? {},
      };

      await importImage(record);
      result.imported++;
    } catch {
      result.failed++;
    }
  }

  return result;
}
