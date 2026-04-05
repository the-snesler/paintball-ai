import { useEffect, useCallback } from "react";
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
import { getReferenceImagesByIds } from "~/lib/db";

export function Lightbox() {
  const navigate = useNavigate();
  const closeLightbox = useGalleryStore((s) => s.closeLightbox);
  const navigateLightbox = useGalleryStore((s) => s.navigateLightbox);
  const deleteItem = useGalleryStore((s) => s.deleteItem);
  const setPrompt = useGalleryStore((s) => s.setPrompt);
  const addReferenceImage = useGalleryStore((s) => s.addReferenceImage);
  const clearReferenceImages = useGalleryStore((s) => s.clearReferenceImages);
  const lightboxTarget = useGalleryStore((s) => s.lightboxTarget);

  const galleryImage = useGalleryStore((s) => {
    if (s.lightboxTarget?.kind !== "gallery") return null;
    const item = s.items.find((i) => i.id === s.lightboxTarget.imageId);
    return item && item.status === "completed" ? item : null;
  });

  const referenceImage = lightboxTarget?.kind === "reference" ? lightboxTarget.image : null;

  const showNavigation = useGalleryStore((s) =>
    s.lightboxTarget?.kind === "gallery"
      ? s.items.filter((i) => i.status === "completed").length > 1
      : false
  );

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

    clearReferenceImages();
    const references = await getReferenceImagesByIds(galleryImage.referenceImageIds);
    references.forEach((reference) => addReferenceImage(reference));

    setPrompt(galleryImage.prompt);
    closeLightbox();
  }, [galleryImage, setPrompt, closeLightbox, clearReferenceImages, addReferenceImage]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={closeLightbox}
      />

      {/* Close button */}
      <button
        onClick={closeLightbox}
        className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 transition-colors"
      >
        <X className="w-6 h-6 text-zinc-300" />
      </button>

      {/* Navigation arrows */}
      {showNavigation && (
        <>
          <button
            onClick={() => navigateLightbox("prev")}
            className="absolute left-4 z-10 p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-zinc-300" />
          </button>
          <button
            onClick={() => navigateLightbox("next")}
            className="absolute right-4 z-10 p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-zinc-300" />
          </button>
        </>
      )}

      {/* Image container */}
      <div className="relative max-w-[90vw] max-h-[85vh] animate-fade-in">
        <img
          src={imageSrc}
          alt={imageAlt}
          className="max-w-full max-h-[85vh] object-contain rounded-lg"
        />
      </div>

      {/* Bottom controls */}
      {galleryImage && (
        <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            {/* Prompt */}
            <div className="bg-zinc-900/90 backdrop-blur-sm rounded-t-lg p-4 border-b border-zinc-800">
              <p className="text-sm text-zinc-300">{galleryImage.prompt}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                <span>{galleryImage.modelName}</span>
                {galleryImage.aspectRatio && (
                  <>
                    <span>·</span>
                    <span>{galleryImage.aspectRatio}</span>
                  </>
                )}
                {galleryImage.resolution && (
                  <>
                    <span>·</span>
                    <span>{galleryImage.resolution}</span>
                  </>
                )}
                {galleryImage.createdAt && (
                  <>
                    <span>·</span>
                    <span>
                      {new Date(galleryImage.createdAt).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-zinc-900/90 backdrop-blur-sm rounded-b-lg p-2 flex items-center justify-center gap-2">
              <ActionButton
                icon={<Download className="w-4 h-4" />}
                label="Download"
                onClick={handleDownload}
              />
              <ActionButton
                icon={<Copy className="w-4 h-4" />}
                label="Copy Prompt"
                onClick={handleCopyPrompt}
              />
              <ActionButton
                icon={<Wand2 className="w-4 h-4" />}
                label="Re-use Prompt"
                onClick={handleReusePrompt}
              />
              <ActionButton
                icon={<FilePenLine className="w-4 h-4" />}
                label="Open in Editor"
                onClick={() => {
                  closeLightbox();
                  navigate(`/editor?imageId=${galleryImage.id}`);
                }}
              />
              <ActionButton
                icon={<Trash2 className="w-4 h-4" />}
                label="Delete"
                onClick={handleDelete}
                variant="danger"
              />
            </div>
          </div>
        </div>
      )}
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

function ActionButton({
  icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        variant === "danger"
          ? "text-red-400 hover:bg-red-500/10"
          : "text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
