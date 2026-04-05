import { ImagePlus, Loader2, Sparkles, X, Wand2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { anyModelSupportsReferenceImages } from "~/lib/models";
import { IMPROVE_PROMPT_SYSTEM } from "~/lib/prompts";
import { callTextModel, isTextModelAvailable } from "~/lib/textModel";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";

export function PromptInput() {
  const prompt = useGalleryStore((s) => s.currentPrompt);
  const setPrompt = useGalleryStore((s) => s.setPrompt);
  const referenceImages = useGalleryStore((s) => s.currentReferenceImages);
  const addReferenceImage = useGalleryStore((s) => s.addReferenceImage);
  const removeReferenceImage = useGalleryStore((s) => s.removeReferenceImage);
  const openLightbox = useGalleryStore((s) => s.openLightbox);
  const modelSelections = useGalleryStore((s) => s.currentModelSelections);
  const galleryItems = useGalleryStore((s) => s.items);
  const models = useSettingsStore((s) => s.models);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImproving, setIsImproving] = useState(false);

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
    setIsImproving(true);
    try {
      const improved = await callTextModel(IMPROVE_PROMPT_SYSTEM, prompt);
      setPrompt(improved.trim());
    } catch {
      // Leave prompt unchanged on failure
    } finally {
      setIsImproving(false);
    }
  }, [prompt, isImproving, setPrompt]);

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Wand2 className="w-4 h-4 text-zinc-500" />
        <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Prompt
        </h2>
      </div>

      <div
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`bg-zinc-800 border rounded-lg transition-colors ${
          isDragOver && referenceEnabled
            ? "border-purple-500 ring-1 ring-purple-500"
            : "border-zinc-700"
        }`}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onPaste={handlePaste}
          placeholder="Describe your image..."
          className="w-full field-sizing-content max-h-1/2 min-h-24 px-3 pt-2 pb-2 bg-transparent rounded-t-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none"
        />

        {isExpanded && (
          <div className="px-3 py-2">
            <div className="max-w-full grid grid-cols-3 gap-2">
              {referenceImages.map((img) => (
                <div key={img.id} className="relative group aspect-square">
                  <button
                    type="button"
                    onClick={() =>
                      openLightbox({
                        kind: "reference",
                        image: { id: img.id, url: img.url, name: img.name },
                      })
                    }
                    className="block w-full h-full cursor-zoom-in"
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="w-full h-full object-cover rounded"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeReferenceImage(img.id);
                    }}
                    disabled={!referenceEnabled}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-zinc-400" />
                  </button>
                </div>
              ))}

              {isDragOver && referenceImages.length === 0 && (
                <div className="col-span-3 border-2 border-dashed border-zinc-600 rounded-lg py-4 text-xs text-zinc-400 text-center">
                  Drop images here
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mx-3 mb-3">
          <label
            className={`inline-flex items-center gap-1 text-xs transition-colors ${
              referenceEnabled
                ? "cursor-pointer text-zinc-400 hover:text-zinc-300"
                : "cursor-not-allowed text-zinc-600"
            }`}
          >
            <ImagePlus className="w-4 h-4" />
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

          <button
            type="button"
            onClick={handleImprovePrompt}
            disabled={!isTextModelAvailable() || !prompt.trim() || isImproving}
            className="inline-flex items-center gap-1 text-xs transition-colors text-zinc-400 hover:text-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-600"
          >
            {isImproving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isImproving ? "Improving..." : "Improve"}
          </button>
        </div>
      </div>
    </section>
  );
}
