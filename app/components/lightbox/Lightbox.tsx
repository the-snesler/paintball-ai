import { useEffect, useCallback, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Copy,
  ClipboardCopy,
  Wand2,
  FilePenLine,
  Expand,
  Layers,
  Layers2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { useGalleryStore } from "~/stores/galleryStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { useEditorStore } from "~/stores/editorStore";
import { GalleryImageCard } from "~/components/gallery/GalleryImageCard";
import { useLightboxNavigation } from "~/hooks/useLightboxNavigation";
import { useGalleryDerivedIndexes } from "~/hooks/useGalleryDerivedIndexes";
import {
  useReuseGalleryItemBasePrompt,
  useReuseGalleryItemPrompt,
} from "~/hooks/useReuseGalleryItemPrompt";
import { useUpscale } from "~/hooks/useUpscale";
import { UPSCALERS } from "~/lib/upscaling";
import { IconButton } from "./IconButton";
import { WideIconButton } from "./WideIconButton";
import { findSessionForImage, getReferenceImagesByIds, saveReferenceImage } from "~/lib/db";
import type { ReferenceImage, StoredEditorSession } from "~/types";

export function Lightbox() {
  const navigate = useNavigate();
  const location = useLocation();
  const closeLightbox = useLightboxStore((s) => s.closeLightbox);
  const deleteItem = useGalleryStore((s) => s.deleteItem);
  const reuseGalleryItemPrompt = useReuseGalleryItemPrompt();
  const reuseGalleryItemBasePrompt = useReuseGalleryItemBasePrompt();
  const { lightboxTarget, galleryImage, referenceImage, showNavigation, navigateLightbox } =
    useLightboxNavigation();

  const openLightbox = useLightboxStore((s) => s.openLightbox);
  const { getPromptGroupForItem, getChildItems, getItemById } = useGalleryDerivedIndexes();
  const setEditorSource = useEditorStore((s) => s.setSource);
  const clearForSessionRestore = useEditorStore((s) => s.clearForSessionRestore);

  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [linkedSession, setLinkedSession] = useState<StoredEditorSession | null>(null);
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

  // Check whether this image is part of any editor session
  useEffect(() => {
    if (!galleryImage) {
      setLinkedSession(null);
      return;
    }
    let cancelled = false;
    void findSessionForImage(galleryImage.id).then((session) => {
      if (!cancelled) setLinkedSession(session);
    });
    return () => {
      cancelled = true;
    };
  }, [galleryImage?.id]);

  const hasBasePrompt = Boolean(galleryImage?.basePrompt);
  const promptGroup = getPromptGroupForItem(galleryImage);
  const childItems = getChildItems(galleryImage?.id);

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
    navigator.clipboard.writeText(galleryImage.basePrompt ?? galleryImage.prompt);
  }, [galleryImage]);

  const handleCopyRawPrompt = useCallback(() => {
    if (!galleryImage) return;
    navigator.clipboard.writeText(galleryImage.prompt);
  }, [galleryImage]);

  const handleReusePrompt = useCallback(async () => {
    if (!galleryImage) return;
    await reuseGalleryItemPrompt(galleryImage);
    closeLightbox();
  }, [galleryImage, reuseGalleryItemPrompt, closeLightbox]);

  const handleReuseBasePrompt = useCallback(async () => {
    if (!galleryImage || !hasBasePrompt) return;
    await reuseGalleryItemBasePrompt(galleryImage);
    closeLightbox();
  }, [galleryImage, hasBasePrompt, reuseGalleryItemBasePrompt, closeLightbox]);

  const handleSendToEditor = useCallback(async () => {
    if (!galleryImage || galleryImage.status !== "completed") return;

    if (linkedSession) {
      // Restore the existing session: save + clear current in-memory state, set the
      // target session in localStorage, then let EditorView's restore effect handle it.
      localStorage.setItem("editorSessionId", linkedSession.id);
      clearForSessionRestore();
      closeLightbox();
      navigate("/editor");
      return;
    }

    const refId = crypto.randomUUID();
    try {
      await saveReferenceImage({
        id: refId,
        blob: galleryImage.originalBlob,
        name: `${galleryImage.modelName} - ${galleryImage.prompt.slice(0, 40)}`,
        sourceGalleryItemId: galleryImage.id,
      });
    } catch {
      // continue without saved reference
    }
    setEditorSource({
      blob: galleryImage.originalBlob,
      prompt: galleryImage.prompt,
      galleryItemId: galleryImage.id,
      referenceId: refId,
    });
    closeLightbox();
    navigate("/editor");
  }, [galleryImage, linkedSession, clearForSessionRestore, setEditorSource, closeLightbox, navigate]);

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
                {location.pathname !== "/editor" && (
                  <WideIconButton
                    icon={
                      <span className="relative">
                        <FilePenLine className="h-4 w-4" />
                        {linkedSession && (
                          <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-purple-400" />
                        )}
                      </span>
                    }
                    title="Editor"
                    tooltip={linkedSession ? "Resume editing session" : undefined}
                    onClick={handleSendToEditor}
                  />
                )}
                <WideIconButton
                  icon={<Expand className="h-4 w-4" />}
                  title={"Upscale"}
                  tooltip={
                    !replicateKey ? "Upscaling requires a Replicate API key" : "Upscale this image"
                  }
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
                  <p className="text-sm whitespace-pre-wrap text-zinc-300">
                    {galleryImage.basePrompt ?? galleryImage.prompt}
                  </p>
                  {hasBasePrompt && (
                    <details className="group/raw">
                      <summary className="cursor-pointer list-none text-xs text-zinc-500 hover:text-zinc-400 [&::-webkit-details-marker]:hidden">
                        Show sent prompt
                      </summary>
                      <p className="mt-2 border-t border-zinc-700/60 pt-2 text-xs leading-snug whitespace-pre-wrap text-zinc-400">
                        {galleryImage.prompt}
                      </p>
                    </details>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <IconButton
                    icon={<Copy className="h-4 w-4" />}
                    title="Copy Prompt"
                    onClick={handleCopyPrompt}
                  />
                  {hasBasePrompt && (
                    <WideIconButton
                      icon={<ClipboardCopy className="h-4 w-4" />}
                      title="Copy raw prompt"
                      tooltip="Copy the actual prompt that was sent to the model"
                      onClick={handleCopyRawPrompt}
                    />
                  )}
                  <IconButton
                    icon={<Wand2 className="h-4 w-4" />}
                    title="Re-use Prompt"
                    onClick={handleReusePrompt}
                  />
                  {hasBasePrompt && (
                    <WideIconButton
                      icon={<Layers className="h-4 w-4" />}
                      title="Re-use Base Prompt"
                      onClick={handleReuseBasePrompt}
                    />
                  )}
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
                    {referenceImages.map((img) => {
                      const sourceItem = img.sourceGalleryItemId
                        ? getItemById(img.sourceGalleryItemId)
                        : null;
                      return sourceItem ? (
                        <GalleryImageCard key={img.id} item={sourceItem} selectionDisabled />
                      ) : (
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
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Children — generations that used this image as a reference */}
              {childItems.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-zinc-400">
                    Children ({childItems.length})
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                    {childItems.map((item) => (
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
