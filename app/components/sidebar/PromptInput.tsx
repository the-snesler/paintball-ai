import { ImagePlus, Loader2, Sparkles, Undo2, X, Wand2 } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { anyModelSupportsReferenceImages } from "~/lib/models";
import { IMPROVE_PROMPT_SYSTEM } from "~/lib/prompts";
import { callTextModel, isTextModelAvailable } from "~/lib/textModel";
import { useGalleryStore } from "~/stores/galleryStore";
import { useGenerationStore } from "~/stores/generationStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import { useSettingsStore } from "~/stores/settingsStore";

function SortableReferenceImage({
  img,
  onRemove,
  onOpen,
  referenceEnabled,
}: {
  img: { id: string; url: string; name: string };
  onRemove: (id: string) => void;
  onOpen: (img: { id: string; url: string; name: string }) => void;
  referenceEnabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.id,
  });

  const style = {
    transform: DndCSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative aspect-square ${isDragging ? "z-50 opacity-75" : ""}`}
    >
      <button
        type="button"
        onClick={() => onOpen(img)}
        className="block h-full w-full cursor-zoom-in"
        {...attributes}
        {...listeners}
      >
        <img src={img.url} alt={img.name} className="h-full w-full rounded object-cover" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(img.id);
        }}
        disabled={!referenceEnabled}
        className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="h-3 w-3 text-zinc-400" />
      </button>
    </div>
  );
}

export function PromptInput() {
  const prompt = useGenerationStore((s) => s.currentPrompt);
  const setPrompt = useGenerationStore((s) => s.setPrompt);
  const basePrompt = useGenerationStore((s) => s.currentBasePrompt);
  const setBasePrompt = useGenerationStore((s) => s.setBasePrompt);
  const referenceImages = useGenerationStore((s) => s.currentReferenceImages);
  const addReferenceImage = useGenerationStore((s) => s.addReferenceImage);
  const removeReferenceImage = useGenerationStore((s) => s.removeReferenceImage);
  const reorderReferenceImages = useGenerationStore((s) => s.reorderReferenceImages);
  const openLightbox = useLightboxStore((s) => s.openLightbox);

  const refDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleRefDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        reorderReferenceImages(active.id as string, over.id as string);
      }
    },
    [reorderReferenceImages]
  );
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const galleryItems = useGalleryStore((s) => s.items);
  const models = useSettingsStore((s) => s.models);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const supportsFieldSizing = useMemo(() => {
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
      return false;
    }

    return CSS.supports("field-sizing", "content");
  }, []);

  const selectedModels = useMemo(
    () =>
      Object.entries(modelSelections)
        .filter(([, count]) => count > 0)
        .map(([modelId]) => modelId),
    [modelSelections]
  );

  const referenceEnabled = anyModelSupportsReferenceImages(models, selectedModels);
  const isExpanded = isDragOver || referenceImages.length > 0;

  const addFiles = useCallback(
    (files: File[]) => {
      if (!referenceEnabled) return;

      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      for (const file of imageFiles) {
        const url = URL.createObjectURL(file);
        addReferenceImage({
          id: crypto.randomUUID(),
          blob: file,
          url,
          name: file.name,
        });
      }
    },
    [addReferenceImage, referenceEnabled]
  );

  const addGalleryImage = useCallback(
    (imageData: string) => {
      if (!referenceEnabled) return;

      try {
        const { imageId, blob, name } = JSON.parse(imageData) as {
          imageId?: string;
          blob?: string;
          name?: string;
        };

        if (imageId) {
          const galleryItem = galleryItems.find((item) => item.id === imageId);
          if (galleryItem && galleryItem.status === "completed") {
            addReferenceImage({
              id: crypto.randomUUID(),
              blob: galleryItem.originalBlob,
              url: URL.createObjectURL(galleryItem.originalBlob),
              name: name || "Gallery image",
              sourceGalleryItemId: imageId,
            });
            return;
          }
        }

        if (typeof blob === "string") {
          fetch(blob)
            .then((res) => res.blob())
            .then((blobData) => {
              const objectUrl = URL.createObjectURL(blobData);
              addReferenceImage({
                id: crypto.randomUUID(),
                blob: blobData,
                url: objectUrl,
                name: name || "Gallery image",
              });
            });
        }
      } catch {
        // Ignore invalid drag payloads.
      }
    },
    [addReferenceImage, referenceEnabled, galleryItems]
  );

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!referenceEnabled) return;

    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file && file.type.startsWith("image/")) {
          addFiles([file]);
        }
      }
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (!referenceEnabled) return;

      const imageData = e.dataTransfer.getData("application/json");
      if (imageData) {
        addGalleryImage(imageData);
      }

      addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles, addGalleryImage, referenceEnabled]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (referenceEnabled) {
        setIsDragOver(true);
      }
    },
    [referenceEnabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (referenceEnabled) {
        setIsDragOver(true);
      }
    },
    [referenceEnabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(Array.from(e.target.files || []));
      e.target.value = "";
    },
    [addFiles]
  );

  const handleImprovePrompt = useCallback(async () => {
    if (!prompt.trim() || isImproving) return;
    const snapshot = prompt;
    setIsImproving(true);
    try {
      const images = referenceImages.length > 0 ? referenceImages.map((r) => r.blob) : undefined;
      const improved = await callTextModel(IMPROVE_PROMPT_SYSTEM, prompt, images);
      setPrompt(improved.trim());
      setBasePrompt(snapshot);
    } catch {
      // Leave prompt unchanged on failure
    } finally {
      setIsImproving(false);
    }
  }, [prompt, isImproving, setPrompt, setBasePrompt, referenceImages]);

  const handleUndoImprove = useCallback(() => {
    if (basePrompt === null) return;
    setPrompt(basePrompt);
    setBasePrompt(null);
  }, [basePrompt, setPrompt, setBasePrompt]);

  useLayoutEffect(() => {
    if (supportsFieldSizing) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [prompt, supportsFieldSizing]);

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-zinc-500" />
        <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Prompt</h2>
      </div>

      <div
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-lg border bg-zinc-800 transition-colors ${
          isDragOver && referenceEnabled
            ? "border-purple-500 ring-1 ring-purple-500"
            : "border-zinc-700"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onPaste={handlePaste}
          placeholder="Describe your image..."
          className="field-sizing-content max-h-1/2 min-h-24 w-full resize-none rounded-t-lg bg-transparent px-3 pt-2 pb-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
        />

        {isExpanded && (
          <div className="px-3 py-2">
            <DndContext
              sensors={refDndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleRefDragEnd}
              autoScroll={false}
            >
              <SortableContext
                items={referenceImages.map((img) => img.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid max-w-full grid-cols-3 gap-2">
                  {referenceImages.map((img) => (
                    <SortableReferenceImage
                      key={img.id}
                      img={img}
                      onRemove={removeReferenceImage}
                      onOpen={(img) =>
                        openLightbox({
                          kind: "reference",
                          image: { id: img.id, url: img.url, name: img.name },
                        })
                      }
                      referenceEnabled={referenceEnabled}
                    />
                  ))}

                  {isDragOver && referenceImages.length === 0 && (
                    <div className="col-span-3 rounded-lg border-2 border-dashed border-zinc-600 py-4 text-center text-xs text-zinc-400">
                      Drop images here
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        <div className="mx-3 mb-3 flex items-center justify-between">
          <label
            className={`inline-flex items-center gap-1 text-xs transition-colors ${
              referenceEnabled
                ? "cursor-pointer text-zinc-400 hover:text-zinc-300"
                : "cursor-not-allowed text-zinc-600"
            }`}
          >
            <ImagePlus className="h-4 w-4" />
            {referenceImages.length > 0 ? "Attach more" : "Attach references"}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              disabled={!referenceEnabled}
              className="hidden"
            />
          </label>

          {basePrompt !== null ? (
            <button
              type="button"
              onClick={handleUndoImprove}
              className="inline-flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-300"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo improve
            </button>
          ) : (
            <button
              type="button"
              onClick={handleImprovePrompt}
              disabled={!isTextModelAvailable() || !prompt.trim() || isImproving}
              className="inline-flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-600"
            >
              {isImproving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isImproving ? "Improving..." : "Improve"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
