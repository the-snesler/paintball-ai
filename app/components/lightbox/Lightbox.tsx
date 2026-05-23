import { useEffect, useCallback, useState } from "react";
import {
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Copy,
  FilePenLine,
  RotateCcw,
  Check,
  CopyPlus,
  ImageUpscale,
  Star,
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
import { IconButton } from "./IconButton";
import { WideIconButton } from "./WideIconButton";
import { findSessionForImage, getReferenceImagesByIds, saveReferenceImage } from "~/lib/db";
import type { ReferenceImage, StoredEditorSession } from "~/types";
import { Accordion } from "@base-ui/react/accordion";
import { logger } from "~/lib/logging";

export function Lightbox() {
  const navigate = useNavigate();
  const location = useLocation();
  const closeLightbox = useLightboxStore((s) => s.closeLightbox);
  const deleteItem = useGalleryStore((s) => s.deleteItem);
  const toggleItemFavorite = useGalleryStore((s) => s.toggleItemFavorite);
  const reuseGalleryItemPrompt = useReuseGalleryItemPrompt();
  const reuseGalleryItemBasePrompt = useReuseGalleryItemBasePrompt();
  const { lightboxTarget, galleryImage, referenceImage, showNavigation, navigateLightbox } =
    useLightboxNavigation();

  const openLightbox = useLightboxStore((s) => s.openLightbox);
  const { getPromptGroupForItem, getChildItems, getItemById } = useGalleryDerivedIndexes();
  const setEditorSource = useEditorStore((s) => s.setSource);
  const clearForSessionRestore = useEditorStore((s) => s.clearForSessionRestore);
  const setPendingFocusedPanel = useEditorStore((s) => s.setPendingFocusedPanel);

  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [linkedSession, setLinkedSession] = useState<StoredEditorSession | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyRawSuccess, setCopyRawSuccess] = useState(false);
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
  }, [galleryImage?.id, galleryImage?.referenceImageIds.join("|")]);

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
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }, [galleryImage]);

  const handleCopyRawPrompt = useCallback(() => {
    if (!galleryImage) return;
    navigator.clipboard.writeText(galleryImage.prompt);
    setCopyRawSuccess(true);
    setTimeout(() => setCopyRawSuccess(false), 2000);
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

  const goToEditor = useCallback(
    async (focusPanel: "upscalers" | null) => {
      if (!galleryImage || galleryImage.status !== "completed") return;

      // Set the navigation hint *before* navigation so the editor sidebar reads it on mount.
      setPendingFocusedPanel(focusPanel);

      if (linkedSession) {
        // Restore the existing session: save + clear current in-memory state, set the
        // target session in localStorage, then let EditorView's restore effect handle it.
        localStorage.setItem("editorSessionId", linkedSession.id);
        clearForSessionRestore();
        closeLightbox();
        navigate("/app/editor");
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
      navigate("/app/editor");
    },
    [
      galleryImage,
      linkedSession,
      clearForSessionRestore,
      setEditorSource,
      setPendingFocusedPanel,
      closeLightbox,
      navigate,
    ]
  );

  const handleSendToEditor = useCallback(() => goToEditor(null), [goToEditor]);
  const handleUpscale = useCallback(() => goToEditor("upscalers"), [goToEditor]);

  const handleDelete = useCallback(async () => {
    if (!galleryImage) return;
    if (confirm("Delete this image?")) {
      await deleteItem(galleryImage.id);
    }
  }, [galleryImage, deleteItem]);

  const handleToggleFavorite = useCallback(() => {
    if (!galleryImage) return;
    void toggleItemFavorite(galleryImage.id);
  }, [galleryImage, toggleItemFavorite]);

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
    galleryImage?.embedding ? "Has embedding" : undefined,
  ].filter(Boolean);

  logger.debug("embedding", galleryImage?.embedding);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={closeLightbox} />

      {/* Close button */}
      <button
        onClick={closeLightbox}
        className="bg-surface-raised/80 hover:bg-surface-overlay absolute top-4 right-4 z-20 rounded-lg p-2 transition-colors"
      >
        <X className="text-text-secondary h-6 w-6" />
      </button>

      {/* Navigation arrows */}
      {showNavigation && (
        <>
          <button
            onClick={() => navigateLightbox("prev")}
            className="bg-surface-raised/80 hover:bg-surface-overlay absolute left-4 z-20 rounded-full p-3 transition-colors"
          >
            <ChevronLeft className="text-text-secondary h-6 w-6" />
          </button>
          <button
            onClick={() => navigateLightbox("next")}
            className="bg-surface-raised/80 hover:bg-surface-overlay absolute right-4 z-20 rounded-full p-3 transition-colors"
          >
            <ChevronRight className="text-text-secondary h-6 w-6" />
          </button>
        </>
      )}

      {/* Modal */}
      <div className="animate-fade-in bg-surface-raised relative z-10 flex max-h-[90vh] max-w-[90vw] flex-col overflow-hidden overflow-y-auto rounded-xl shadow-2xl inset-shadow-sm inset-shadow-white/5 lg:flex-row lg:items-stretch">
        {/* Image */}
        <img
          src={imageSrc}
          alt={imageAlt}
          className="block min-h-[50vh] min-w-0 self-center object-contain lg:max-h-[90vh] lg:min-h-0 lg:max-w-[calc(90vw-24rem)] xl:max-w-[calc(90vw-28rem)]"
        />

        {/* Info panel */}
        {galleryImage && (
          <div className="border-border-subtle flex shrink-0 flex-col border-t lg:w-96 lg:border-t-0 lg:border-l xl:w-md">
            {/* Header */}
            <div className="border-border-subtle flex items-center justify-between gap-2 border-b p-4">
              <h2 className="text-text-primary truncate text-lg font-semibold">
                {galleryImage.modelName}
              </h2>
              <div className="flex items-center gap-1">
                {location.pathname !== "/app/editor" && (
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
                {location.pathname !== "/app/editor" && (
                  <WideIconButton
                    icon={<ImageUpscale className="h-4 w-4" />}
                    title="Upscale"
                    tooltip={
                      !replicateKey
                        ? "Upscaling requires a Replicate API key"
                        : "Open in editor with upscalers"
                    }
                    onClick={handleUpscale}
                    disabled={!replicateKey || galleryImage.status !== "completed"}
                  />
                )}
                <IconButton
                  icon={
                    <Star
                      className={`h-4 w-4 ${galleryImage.isFavorite ? "fill-current text-yellow-300" : ""}`}
                    />
                  }
                  title={galleryImage.isFavorite ? "Unfavorite" : "Favorite"}
                  onClick={handleToggleFavorite}
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
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {/* Metadata */}
              {topMetadataRow && (
                <div className="text-text-muted flex flex-wrap items-center gap-2 text-xs">
                  {topMetadataRow.map((meta, i) => (
                    <span key={i} className="bg-surface-overlay/50 rounded-lg px-2 py-1">
                      {meta}
                    </span>
                  ))}
                </div>
              )}

              {/* Prompt */}
              <div className="space-y-2">
                <div className="bg-surface-overlay/50 space-y-2 rounded-lg p-3">
                  <p className="text-text-secondary text-sm whitespace-pre-wrap">
                    {galleryImage.basePrompt ?? galleryImage.prompt}
                  </p>
                  {hasBasePrompt && (
                    <Accordion.Root className="border-c-border/60 border-t pt-2">
                      <Accordion.Item>
                        <Accordion.Header>
                          <Accordion.Trigger className="group text-text-muted hover:text-text-tertiary inline-flex cursor-pointer list-none items-center gap-1 text-xs [&::-webkit-details-marker]:hidden">
                            <span>Show sent prompt</span>
                            <ChevronDown className="text-text-muted group-hover:text-text-tertiary h-4 w-4 -rotate-90 transition-transform duration-200 group-data-panel-open:rotate-0" />
                          </Accordion.Trigger>
                        </Accordion.Header>
                        <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] data-ending-style:h-0 data-starting-style:h-0">
                          <p className="text-text-tertiary mt-2 text-xs leading-snug whitespace-pre-wrap">
                            {galleryImage.prompt}
                          </p>
                        </Accordion.Panel>
                      </Accordion.Item>
                    </Accordion.Root>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <IconButton
                    icon={
                      copySuccess ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )
                    }
                    title="Copy Prompt"
                    onClick={handleCopyPrompt}
                  />
                  {hasBasePrompt && (
                    <IconButton
                      icon={
                        copyRawSuccess ? (
                          <Check className="h-4 w-4 text-green-400" />
                        ) : (
                          <CopyPlus className="h-4 w-4" />
                        )
                      }
                      title="Copy sent prompt (actual prompt that was sent to the model)"
                      onClick={handleCopyRawPrompt}
                    />
                  )}
                  <IconButton
                    icon={<RotateCcw className="h-4 w-4" />}
                    title="Re-use Prompt"
                    onClick={handleReusePrompt}
                  />
                </div>
              </div>

              {/* Date */}
              {galleryImage.createdAt && (
                <p className="text-text-muted text-xs">
                  {new Date(galleryImage.createdAt).toLocaleString()}
                </p>
              )}

              {/* Other generations */}
              {promptGroup.length > 1 && (
                <div className="space-y-2">
                  <h3 className="text-text-tertiary text-xs font-medium">
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
                  <h3 className="text-text-tertiary text-xs font-medium">
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
                          className="bg-surface-overlay hover:ring-c-border overflow-hidden rounded-lg transition-all hover:ring-2"
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
                  <h3 className="text-text-tertiary text-xs font-medium">
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
