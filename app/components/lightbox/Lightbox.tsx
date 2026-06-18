import { useEffect, useCallback, useState, type ReactNode } from "react";
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
  User,
  Pencil,
} from "lucide-react";
import { Select } from "@base-ui/react/select";
import { useLocation, useNavigate } from "react-router";
import { useGalleryStore } from "~/stores/galleryStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { useEditorStore } from "~/stores/editorStore";
import { RelatedThumbnail } from "./RelatedThumbnail";
import { useLightboxNavigation } from "~/hooks/useLightboxNavigation";
import { useGalleryDerivedIndexes } from "~/hooks/useGalleryDerivedIndexes";
import {
  useReuseGalleryItemBasePrompt,
  useReuseGalleryItemPrompt,
} from "~/hooks/useReuseGalleryItemPrompt";
import { IconButton } from "./IconButton";
import { ScorecardPanel } from "./ScorecardPanel";
import { WideIconButton } from "./WideIconButton";
import { findSessionForImage, getReferenceImagesByIds, saveReferenceImage } from "~/lib/db";
import type {
  CompletedGalleryItem,
  ReferenceImage,
  StoredCharacter,
  StoredEditorSession,
} from "~/types";
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

  const { getPromptGroupForItem, getChildItems, getItemById } = useGalleryDerivedIndexes();
  const setEditorSource = useEditorStore((s) => s.setSource);
  const clearForSessionRestore = useEditorStore((s) => s.clearForSessionRestore);
  const setPendingFocusedPanel = useEditorStore((s) => s.setPendingFocusedPanel);

  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [linkedSession, setLinkedSession] = useState<StoredEditorSession | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyRawSuccess, setCopyRawSuccess] = useState(false);
  const replicateKey = useSettingsStore((s) => s.apiKeys.replicate);
  const allCharacters = useSettingsStore((s) => s.characters);
  const updateImageCharacters = useGalleryStore((s) => s.updateImageCharacters);
  const [editingCharacters, setEditingCharacters] = useState(false);

  useEffect(() => {
    setEditingCharacters(false);
  }, [galleryImage?.id]);

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

  // Clicking the empty letterbox area around the image closes the lightbox, but
  // clicking the visible image pixels does not. Because the <img> uses
  // object-contain, its element box can be larger than the rendered image, so we
  // only swallow the click when it lands inside the actual rendered rectangle.
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const { naturalWidth, naturalHeight } = img;
    const rect = img.getBoundingClientRect();
    if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) return;

    const scale = Math.min(rect.width / naturalWidth, rect.height / naturalHeight);
    const renderedWidth = naturalWidth * scale;
    const renderedHeight = naturalHeight * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const onImage =
      x >= offsetX &&
      x <= offsetX + renderedWidth &&
      y >= offsetY &&
      y <= offsetY + renderedHeight;

    // Only block the close when the click is on the actual image pixels;
    // letterbox clicks fall through to the section handler below.
    if (onImage) e.stopPropagation();
  }, []);

  if (!galleryImage && !referenceImage) return null;

  const imageSrc = galleryImage?.originalUrl ?? referenceImage?.url ?? "";
  const thumbnailSrc = galleryImage?.thumbnailUrl ?? imageSrc;
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
    <div className="bg-surface fixed inset-0 z-50 h-dvh overflow-hidden text-white">
      <img
        src={thumbnailSrc}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-3xl saturate-125"
      />

      <button
        type="button"
        aria-label="Close lightbox"
        className="absolute inset-0 cursor-default"
        onClick={closeLightbox}
      />

      <div className="animate-fade-in relative z-10 flex h-full min-h-0 flex-col gap-3">
        <header className="border-text-secondary/10 text-text-secondary/80 flex min-h-14 shrink-0 items-center gap-2 border-b px-2.5 py-2 sm:px-3">
          {showNavigation && (
            <div className="flex items-center gap-1">
              <IconButton
                icon={<ChevronLeft className="h-4 w-4" />}
                title="Previous image"
                onClick={() => navigateLightbox("prev")}
              />
              <IconButton
                icon={<ChevronRight className="h-4 w-4" />}
                title="Next image"
                onClick={() => navigateLightbox("next")}
              />
            </div>
          )}

          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-medium">
              {galleryImage?.modelName ?? referenceImage?.name ?? "Image preview"}
            </p>
          </div>

          {galleryImage && (
            <div className="flex shrink-0 items-center gap-1 overflow-x-auto">
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
                  textBreakpoint="lg"
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
                  textBreakpoint="lg"
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
          )}

          <IconButton icon={<X className="h-4 w-4" />} title="Close" onClick={closeLightbox} />
        </header>

        <main
          className={`mx-2 min-h-0 flex-1 gap-3 overflow-y-auto lg:mx-4 lg:mb-4 lg:grid lg:overflow-visible ${
            galleryImage
              ? "lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem]"
              : "lg:grid-cols-1"
          }`}
        >
          <section
            className="flex min-h-[52dvh] cursor-default items-center justify-center overflow-hidden lg:min-h-0"
            onClick={closeLightbox}
          >
            <img
              src={imageSrc}
              alt={imageAlt}
              onClick={handleImageClick}
              className="block max-h-[calc(70dvh)] max-w-full cursor-auto object-contain lg:h-full lg:max-h-full lg:w-full"
            />
          </section>

          {galleryImage && (
            <aside className="border-c-border/60 bg-surface-raised/85 mt-3 flex min-h-0 flex-col overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl lg:mt-0">
              <div className="border-border-subtle flex shrink-0 items-start justify-between gap-3 border-b p-4">
                <div className="min-w-0">
                  <h2 className="text-text-primary truncate text-base font-semibold">
                    {galleryImage.modelName}
                  </h2>
                  {galleryImage.createdAt && (
                    <p className="text-text-muted mt-1 text-xs">
                      {new Date(galleryImage.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                {galleryImage.isFavorite && (
                  <Star className="h-4 w-4 shrink-0 fill-current text-yellow-300" />
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {topMetadataRow.length > 0 && (
                  <div className="text-text-muted flex flex-wrap items-center gap-2 text-xs">
                    {topMetadataRow.map((meta, i) => (
                      <span
                        key={i}
                        className="bg-surface-overlay/60 border-c-border/50 rounded-lg border px-2 py-1"
                      >
                        {meta}
                      </span>
                    ))}
                  </div>
                )}

                <ScorecardPanel image={galleryImage} />

                <PanelSection title="Characters">
                  <CharacterSection
                    galleryImage={galleryImage}
                    allCharacters={allCharacters}
                    editing={editingCharacters}
                    onEditToggle={() => setEditingCharacters((v) => !v)}
                    onCharactersChange={(ids) => {
                      void updateImageCharacters(galleryImage.id, ids);
                      setEditingCharacters(false);
                    }}
                  />
                </PanelSection>

                <PanelSection title="Prompt">
                  <div className="space-y-2">
                    <div className="bg-surface-overlay/50 border-c-border/50 space-y-2 rounded-lg border p-3">
                      <p className="text-text-secondary text-sm whitespace-pre-wrap">
                        {galleryImage.basePrompt ?? galleryImage.prompt}
                      </p>
                      {hasBasePrompt && (
                        <Accordion.Root className="border-c-border/60 border-t pt-2">
                          <Accordion.Item>
                            <Accordion.Header>
                              <Accordion.Trigger className="group text-text-muted hover:text-text-tertiary inline-flex list-none items-center gap-1 text-xs [&::-webkit-details-marker]:hidden">
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
                      {hasBasePrompt && (
                        <button
                          type="button"
                          onClick={handleReuseBasePrompt}
                          className="text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary rounded-lg px-2 py-2 text-xs transition-colors"
                        >
                          Re-use base
                        </button>
                      )}
                    </div>
                  </div>
                </PanelSection>

                {promptGroup.length > 1 && (
                  <PanelSection title={`All outputs (${promptGroup.length})`}>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                      {promptGroup.map((item) => (
                        <RelatedThumbnail
                          key={item.id}
                          kind="gallery-item"
                          current={galleryImage}
                          item={item}
                        />
                      ))}
                    </div>
                  </PanelSection>
                )}

                {referenceImages.length > 0 && (
                  <PanelSection title={`Reference images (${referenceImages.length})`}>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                      {referenceImages.map((img) => {
                        const sourceItem = img.sourceGalleryItemId
                          ? getItemById(img.sourceGalleryItemId)
                          : null;
                        return sourceItem ? (
                          <RelatedThumbnail
                            key={img.id}
                            kind="gallery-item"
                            current={galleryImage}
                            item={sourceItem}
                          />
                        ) : (
                          <RelatedThumbnail
                            key={img.id}
                            kind="external-ref"
                            current={galleryImage}
                            image={img}
                          />
                        );
                      })}
                    </div>
                  </PanelSection>
                )}

                {childItems.length > 0 && (
                  <PanelSection title={`Children (${childItems.length})`}>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                      {childItems.map((item) => (
                        <RelatedThumbnail
                          key={item.id}
                          kind="gallery-item"
                          current={galleryImage}
                          item={item}
                        />
                      ))}
                    </div>
                  </PanelSection>
                )}
              </div>
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-text-tertiary text-xs font-medium">{title}</h3>
      {children}
    </section>
  );
}

function CharacterSection({
  galleryImage,
  allCharacters,
  editing,
  onEditToggle,
  onCharactersChange,
}: {
  galleryImage: CompletedGalleryItem;
  allCharacters: StoredCharacter[];
  editing: boolean;
  onEditToggle: () => void;
  onCharactersChange: (ids: string[]) => void;
}) {
  const assignedIds = galleryImage.characterIds ?? [];
  const assignedCharacters = assignedIds
    .map((id) => allCharacters.find((c) => c.id === id))
    .filter((c): c is StoredCharacter => c !== undefined);

  if (allCharacters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {assignedCharacters.length > 0 &&
        !editing &&
        assignedCharacters.map((c) => (
          <span
            key={c.id}
            className="flex items-center gap-1 rounded-lg bg-purple-500/10 px-2 py-1 text-xs text-purple-300"
          >
            <User className="h-3 w-3 shrink-0" />
            {c.name}
          </span>
        ))}
      {assignedCharacters.length === 0 && !editing && (
        <span className="text-text-muted text-xs">No character assigned</span>
      )}
      {editing ? (
        <Select.Root<string, true>
          multiple
          value={assignedIds}
          onValueChange={(ids) => onCharactersChange(ids)}
        >
          <Select.Trigger className="border-c-border bg-surface-raised text-text-secondary flex items-center gap-1 rounded-lg border px-2 py-1 text-xs">
            <User className="h-3 w-3 shrink-0" />
            <Select.Value>
              {assignedIds.length === 0 ? "Select characters" : `${assignedIds.length} selected`}
            </Select.Value>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner sideOffset={6} className="z-[60]">
              <Select.Popup className="bg-surface-overlay border-c-border animate-in fade-in zoom-in-95 max-h-60 min-w-44 overflow-y-auto rounded-lg border p-1 text-sm shadow-lg">
                {allCharacters.map((character) => (
                  <Select.Item
                    key={character.id}
                    value={character.id}
                    className="text-text-secondary data-highlighted:bg-surface-raised flex items-center gap-2 rounded px-2 py-1.5 outline-none"
                  >
                    <span className="flex h-3 w-3 items-center justify-center">
                      <Select.ItemIndicator>
                        <Check className="h-3 w-3" />
                      </Select.ItemIndicator>
                    </span>
                    <Select.ItemText>{character.name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ) : null}
      <button
        onClick={onEditToggle}
        title={editing ? "Cancel" : "Edit characters"}
        className="text-text-muted hover:text-text-secondary flex h-5 w-5 items-center justify-center rounded transition-colors"
      >
        {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
      </button>
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
