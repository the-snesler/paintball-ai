import JSZip from "jszip";
import mime from "mime/lite";
import type { StoredImageRecord } from "~/types";
import {
  getAllImages,
  getAllReferenceImages,
  getExistingImageIds,
  getExistingReferenceImageIds,
  importImage,
  saveReferenceImage,
} from "./db";
import { createThumbnailBlob } from "./imageProcessing";

// Derived from StoredImageRecord so any new field added there is automatically
// included in the export manifest. Only the binary blobs are stripped (they
// live as separate files inside the zip).
type ManifestEntry = Omit<StoredImageRecord, "originalBlob" | "thumbnailBlob"> & {
  filename: string;
};

type ReferencesManifestEntry = {
  id: string;
  name: string;
  filename: string;
  sourceGalleryItemId?: string;
};

export async function exportAllImages(
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const images = await getAllImages();
  if (images.length === 0) return;

  const zip = new JSZip();
  const manifest: ManifestEntry[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const ext = mime.getExtension(image.originalBlob.type) || "png";
    const filename = `images/${image.id}.${ext}`;

    zip.file(filename, image.originalBlob);

    // Spread the whole record minus blobs so any new fields on StoredImageRecord
    // round-trip through export without needing to be added here.
    const { originalBlob: _o, thumbnailBlob: _t, ...rest } = image;
    void _o;
    void _t;
    manifest.push({ ...rest, filename });

    onProgress?.(i + 1, images.length);
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const referenceImages = await getAllReferenceImages();
  const referencesManifest: ReferencesManifestEntry[] = [];
  for (const ref of referenceImages) {
    const ext = mime.getExtension(ref.blob.type) || "png";
    const filename = `references/${ref.id}.${ext}`;
    zip.file(filename, ref.blob);
    const entry: ReferencesManifestEntry = { id: ref.id, name: ref.name, filename };
    if (ref.sourceGalleryItemId) entry.sourceGalleryItemId = ref.sourceGalleryItemId;
    referencesManifest.push(entry);
  }
  zip.file("references-manifest.json", JSON.stringify(referencesManifest, null, 2));

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
  referencesImported: number;
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
  const result: ImportResult = { imported: 0, referencesImported: 0, skipped: 0, failed: 0 };

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
      const originalBlob = new Blob([arrayBuffer], {
        type: mime.getType(ext) || "application/octet-stream",
      });
      const thumbnailBlob = await createThumbnailBlob(originalBlob, 400);

      // Spread the manifest entry so any new fields added to StoredImageRecord
      // round-trip through import without needing to be added here.
      const { filename: _f, ...entryRest } = entry;
      void _f;
      const record: StoredImageRecord = {
        ...entryRest,
        originalBlob,
        thumbnailBlob,
        referenceImageIds: entry.referenceImageIds ?? [],
        metadata: entry.metadata ?? {},
      };

      await importImage(record);
      result.imported++;
    } catch {
      result.failed++;
    }
  }

  const referencesManifestFile = zip.file("references-manifest.json");
  if (referencesManifestFile) {
    const referencesManifest: ReferencesManifestEntry[] = JSON.parse(
      await referencesManifestFile.async("text")
    );
    const existingRefIds = await getExistingReferenceImageIds();

    for (const entry of referencesManifest) {
      if (existingRefIds.has(entry.id)) {
        result.skipped++;
        continue;
      }
      try {
        const refFile = zip.file(entry.filename);
        if (!refFile) {
          result.failed++;
          continue;
        }
        const ext = entry.filename.split(".").pop() || "png";
        const arrayBuffer = await refFile.async("arraybuffer");
        const blob = new Blob([arrayBuffer], {
          type: mime.getType(ext) || "application/octet-stream",
        });
        await saveReferenceImage({
          id: entry.id,
          name: entry.name,
          blob,
          sourceGalleryItemId: entry.sourceGalleryItemId,
        });
        result.referencesImported++;
      } catch {
        result.failed++;
      }
    }
  }

  return result;
}
