import { useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Copy,
  Wand2,
} from "lucide-react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useGenerationStore } from "~/stores/generationStore";

export function Lightbox() {
  const closeLightbox = useGalleryStore((s) => s.closeLightbox);
  const navigateLightbox = useGalleryStore((s) => s.navigateLightbox);
  const deleteImage = useGalleryStore((s) => s.deleteImage);
  const getSelectedImage = useGalleryStore((s) => s.getSelectedImage);
  const images = useGalleryStore((s) => s.images);
  const setPrompt = useGenerationStore((s) => s.setPrompt);

  const image = getSelectedImage();

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          closeLightbox();
          break;
        case "ArrowLeft":
          navigateLightbox("prev");
          break;
        case "ArrowRight":
          navigateLightbox("next");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeLightbox, navigateLightbox]);

  const handleDownload = useCallback(() => {
    if (!image) return;

    const link = document.createElement("a");
    link.href = image.url;
    link.download = `${image.modelName}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [image]);

  const handleCopyPrompt = useCallback(() => {
    if (!image) return;
    navigator.clipboard.writeText(image.prompt);
  }, [image]);

  const handleReusePrompt = useCallback(() => {
    if (!image) return;
    setPrompt(image.prompt);
    closeLightbox();
  }, [image, setPrompt, closeLightbox]);

  const handleDelete = useCallback(async () => {
    if (!image) return;
    if (confirm("Delete this image?")) {
      await deleteImage(image.id);
    }
  }, [image, deleteImage]);

  if (!image) return null;

  const showNavigation = images.length > 1;

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
          src={image.url}
          alt={image.prompt}
          className="max-w-full max-h-[85vh] object-contain rounded-lg"
        />
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="max-w-2xl mx-auto">
          {/* Prompt */}
          <div className="bg-zinc-900/90 backdrop-blur-sm rounded-t-lg p-4 border-b border-zinc-800">
            <p className="text-sm text-zinc-300">{image.prompt}</p>
            <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
              <span>{image.modelName}</span>
              <span>·</span>
              <span>{image.aspectRatio}</span>
              {image.resolution && (
                <>
                  <span>·</span>
                  <span>{image.resolution}</span>
                </>
              )}
              <span>·</span>
              <span>
                {new Date(image.createdAt).toLocaleString()}
              </span>
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
              icon={<Trash2 className="w-4 h-4" />}
              label="Delete"
              onClick={handleDelete}
              variant="danger"
            />
          </div>
        </div>
      </div>
    </div>
  );
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
