import { useEffect, useCallback, useMemo, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Copy,
  Wand2,
  FilePenLine,
  Expand,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useGalleryStore } from "~/stores/galleryStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { groupItemsByPrompt, getPromptKey } from "~/lib/galleryGrouping";
import { GalleryImageCard } from "~/components/gallery/GalleryImageCard";
import { useLightboxNavigation } from "~/hooks/useLightboxNavigation";
import { useReuseGalleryItemPrompt } from "~/hooks/useReuseGalleryItemPrompt";
import { useUpscale } from "~/hooks/useUpscale";
import { UPSCALERS } from "~/lib/upscaling";
import { IconButton } from "./IconButton";
import { WideIconButton } from "./WideIconButton";
import { getReferenceImagesByIds } from "~/lib/db";
import type { ReferenceImage } from "~/types";

export function Lightbox() {
  const navigate = useNavigate();
  const closeLightbox = useLightboxStore((s) => s.closeLightbox);
  const deleteItem = useGalleryStore((s) => s.deleteItem);
  const reuseGalleryItemPrompt = useReuseGalleryItemPrompt();
  const { lightboxTarget, galleryImage, referenceImage, showNavigation, navigateLightbox } =
    useLightboxNavigation();

  const openLightbox = useLightboxStore((s) => s.openLightbox);
  const items = useGalleryStore((s) => s.items);

  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [showUpscalePicker, setShowUpscalePicker] = useState(false);
  const { status: upscaleStatus, error: upscaleError, upscale } = useUpscale();
  const replicateKey = useSettingsStore((s) => s.apiKeys.replicate);

  useEffect(() => {
    if (!galleryImage || galleryImage.referenceImageIds.length === 0) {
      setReferenceImages([]);
      return;
    }

    let cancelled = false;
    const loaded: string[] = [];

    getReferenceImagesByIds(galleryImage.referenceImageIds).then((images) => {
      if (cancelled) {
        images.forEach((img) => URL.revokeObjectURL(img.url));
        return;
      }
      loaded.push(...images.map((img) => img.url));
      setReferenceImages(images);
    });

    return () => {
      cancelled = true;
      loaded.forEach((url) => URL.revokeObjectURL(url));
      setReferenceImages([]);
    };
  }, [galleryImage?.id]);

  useEffect(() => {
    setShowUpscalePicker(false);
  }, [galleryImage?.id]);

  const promptGroup = useMemo(() => {
    if (!galleryImage) return [];
    const groups = groupItemsByPrompt(items);
    return groups.get(getPromptKey(galleryImage)) ?? [];
  }, [items, galleryImage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          closeLightbox();
          break;
        case "ArrowLeft":
          if (lightboxTarget?.kind === "gallery") {
            navigateLightbox("prev");
          }
          break;
        case "ArrowRight":
          if (lightboxTarget?.kind === "gallery") {
            navigateLightbox("next");
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeLightbox, lightboxTarget, navigateLightbox]);

  const handleDownload = useCallback(() => {
    if (!galleryImage || galleryImage.status !== "completed") return;

    const link = document.createElement("a");
    link.href = galleryImage.originalUrl;
    link.download = `${galleryImage.modelName}-${Date.now()}.${getBlobExtension(galleryImage.originalBlob)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [galleryImage]);

  const handleCopyPrompt = useCallback(() => {
    if (!galleryImage) return;
    navigator.clipboard.writeText(galleryImage.prompt);
  }, [galleryImage]);

  const handleReusePrompt = useCallback(async () => {
    if (!galleryImage) return;
    await reuseGalleryItemPrompt(galleryImage);
    closeLightbox();
  }, [galleryImage, reuseGalleryItemPrompt, closeLightbox]);

  const handleDelete = useCallback(async () => {
    if (!galleryImage) return;
    if (confirm("Delete this image?")) {
      await deleteItem(galleryImage.id);
    }
  }, [galleryImage, deleteItem]);

  if (!galleryImage && !referenceImage) return null;

  const imageSrc = galleryImage?.originalUrl ?? referenceImage?.url ?? "";
  const imageAlt = galleryImage?.prompt ?? referenceImage?.name ?? "Image preview";

  const topMetadataRow = [
    galleryImage?.aspectRatio,
    galleryImage?.resolution,
    `${galleryImage?.width}x${galleryImage?.height}`,
    galleryImage?.generationTimeMs != null
      ? `${(galleryImage.generationTimeMs / 1000).toFixed(1)}s`
      : undefined,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={closeLightbox} />

      {/* Close button */}
      <button
        onClick={closeLightbox}
        className="absolute top-4 right-4 z-20 rounded-lg bg-zinc-900/80 p-2 transition-colors hover:bg-zinc-800"
      >
        <X className="h-6 w-6 text-zinc-300" />
      </button>

      {/* Navigation arrows */}
      {showNavigation && (
        <>
          <button
            onClick={() => navigateLightbox("prev")}
            className="absolute left-4 z-20 rounded-full bg-zinc-900/80 p-3 transition-colors hover:bg-zinc-800"
          >
            <ChevronLeft className="h-6 w-6 text-zinc-300" />
          </button>
          <button
            onClick={() => navigateLightbox("next")}
            className="absolute right-4 z-20 rounded-full bg-zinc-900/80 p-3 transition-colors hover:bg-zinc-800"
          >
            <ChevronRight className="h-6 w-6 text-zinc-300" />
          </button>
        </>
      )}

      {/* Modal */}
      <div className="animate-fade-in relative z-10 flex max-h-[90vh] max-w-[90vw] flex-col overflow-hidden overflow-y-auto rounded-xl bg-zinc-900 shadow-2xl inset-shadow-sm inset-shadow-white/5 lg:flex-row lg:items-stretch">
        {/* Image */}
        <img
          src={imageSrc}
          alt={imageAlt}
          className="block min-h-[50vh] min-w-0 self-center object-contain lg:max-h-[90vh] lg:min-h-0 lg:max-w-[calc(90vw-24rem)] xl:max-w-[calc(90vw-28rem)]"
        />

        {/* Info panel */}
        {galleryImage && (
          <div className="flex shrink-0 flex-col border-t border-zinc-800 lg:w-96 lg:border-t-0 lg:border-l xl:w-md">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 p-4">
              <h2 className="truncate text-lg font-semibold text-zinc-100">
                {galleryImage.modelName}
              </h2>
              <div className="flex items-center gap-1">
                <IconButton
                  icon={<FilePenLine className="h-4 w-4" />}
                  title="Send to Editor"
                  onClick={() => {
                    closeLightbox();
                    navigate(`/editor?imageId=${galleryImage.id}`);
                  }}
                />
                <IconButton
                  icon={<Expand className="h-4 w-4" />}
                  title={replicateKey ? "Upscale" : "Upscale (add Replicate API key in Settings)"}
                  onClick={() => setShowUpscalePicker((v) => !v)}
                  disabled={
                    !replicateKey ||
                    galleryImage.status !== "completed" ||
                    upscaleStatus === "running"
                  }
                />
                <IconButton
                  icon={<Download className="h-4 w-4" />}
                  title="Download"
                  onClick={handleDownload}
                />
                <IconButton
                  icon={<Trash2 className="h-4 w-4" />}
                  title="Delete"
                  onClick={handleDelete}
                  variant="danger"
                />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Upscale picker */}
              {showUpscalePicker && galleryImage.status === "completed" && (
                <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                  <p className="text-xs font-medium text-zinc-400">Upscale with</p>
                  <div className="flex flex-wrap gap-1.5">
                    {UPSCALERS.map((u) => (
                      <button
                        key={u.label}
                        disabled={upscaleStatus === "running"}
                        onClick={() => {
                          upscale(galleryImage, u);
                          setShowUpscalePicker(false);
                        }}
                        className="rounded-md bg-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:bg-zinc-700/50 disabled:text-zinc-600"
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                  {upscaleStatus === "running" && (
                    <p className="text-xs text-zinc-500">Upscaling…</p>
                  )}
                  {upscaleStatus === "error" && upscaleError && (
                    <p className="text-xs text-red-400">{upscaleError}</p>
                  )}
                </div>
              )}

              {/* Metadata */}
              {topMetadataRow && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  {topMetadataRow}
                </div>
              )}

              {/* Prompt */}
              <div className="space-y-2">
                <div className="space-y-2 rounded-lg bg-zinc-800/50 p-3">
                  <p className="text-sm text-zinc-300">{galleryImage.prompt}</p>
                  <div className="flex items-center gap-1">
                    <IconButton
                      icon={<Copy className="h-4 w-4" />}
                      title="Copy Prompt"
                      onClick={handleCopyPrompt}
                    />
                    <WideIconButton
                      icon={<Wand2 className="h-4 w-4" />}
                      title="Re-use Prompt"
                      onClick={handleReusePrompt}
                    />
                  </div>
                </div>
              </div>

              {/* Date */}
              {galleryImage.createdAt && (
                <p className="text-xs text-zinc-500">
                  {new Date(galleryImage.createdAt).toLocaleString()}
                </p>
              )}

              {/* Other generations */}
              {promptGroup.length > 1 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-zinc-400">
                    All outputs ({promptGroup.length})
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                    {promptGroup.map((item) => (
                      <GalleryImageCard key={item.id} item={item} selectionDisabled />
                    ))}
                  </div>
                </div>
              )}

              {/* Reference images */}
              {referenceImages.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-zinc-400">
                    Reference images ({referenceImages.length})
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                    {referenceImages.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => openLightbox({ kind: "reference", image: img })}
                        className="overflow-hidden rounded-lg bg-zinc-800 transition-all hover:ring-2 hover:ring-zinc-500"
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className="aspect-square w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getBlobExtension(blob: Blob): string {
  const type = blob.type.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  return "png";
}
