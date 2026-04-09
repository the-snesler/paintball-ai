import { useEffect, useCallback, useMemo } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Copy,
  Wand2,
  FilePenLine,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useGalleryStore } from "~/stores/galleryStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import { groupItemsByPrompt, getPromptKey } from "~/lib/galleryGrouping";
import { GalleryImageCard } from "~/components/gallery/GalleryImageCard";
import { useLightboxNavigation } from "~/hooks/useLightboxNavigation";
import { useReuseGalleryItemPrompt } from "~/hooks/useReuseGalleryItemPrompt";
import { IconButton } from "./IconButton";
import { WideIconButton } from "./WideIconButton";

export function Lightbox() {
  const navigate = useNavigate();
  const closeLightbox = useLightboxStore((s) => s.closeLightbox);
  const deleteItem = useGalleryStore((s) => s.deleteItem);
  const reuseGalleryItemPrompt = useReuseGalleryItemPrompt();
  const { lightboxTarget, galleryImage, referenceImage, showNavigation, navigateLightbox } =
    useLightboxNavigation();

  const items = useGalleryStore((s) => s.items);

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
                  title="Open in Editor"
                  onClick={() => {
                    closeLightbox();
                    navigate(`/editor?imageId=${galleryImage.id}`);
                  }}
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
              {/* Metadata */}
              {(galleryImage.aspectRatio || galleryImage.resolution) && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  {galleryImage.aspectRatio && <span>{galleryImage.aspectRatio}</span>}
                  {galleryImage.aspectRatio && galleryImage.resolution && <span>·</span>}
                  {galleryImage.resolution && <span>{galleryImage.resolution}</span>}
                </div>
              )}

              {/* Prompt */}
              <div className="space-y-2">
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <p className="text-sm text-zinc-300">{galleryImage.prompt}</p>
                </div>
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
