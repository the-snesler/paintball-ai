import { Check } from "lucide-react";
import { useState, useCallback, type ChangeEvent, type MouseEvent } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import type { CompletedGalleryItem } from "~/types";

interface ImageCardProps {
  image: CompletedGalleryItem;
}

export function ImageCard({ image }: ImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const openLightbox = useGalleryStore((s) => s.openLightbox);
  const selectedItemIds = useGalleryStore((s) => s.selectedItemIds);
  const toggleItemSelection = useGalleryStore((s) => s.toggleItemSelection);
  const selectItemRange = useGalleryStore((s) => s.selectItemRange);
  const isSelected = selectedItemIds.includes(image.id);
  const checkboxId = `gallery-select-${image.id}`;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.shiftKey) {
      event.preventDefault();
      selectItemRange(image.id);
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      toggleItemSelection(image.id);
      return;
    }

    openLightbox({ kind: "gallery", imageId: image.id });
  };

  const handleSelectToggle = (event: ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    toggleItemSelection(image.id);
  };

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      // Set drag data for reference images
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          id: image.id,
          imageId: image.id,
          blob: image.originalUrl,
          name: `${image.modelName} - ${image.prompt.slice(0, 30)}`,
        })
      );
      e.dataTransfer.effectAllowed = "copy";
    },
    [image]
  );

  return (
    <div
      className={`group animate-fade-in relative h-fit cursor-pointer overflow-hidden rounded-lg bg-zinc-900 outline-[1.5px] ${
        isSelected ? "outline-purple-500" : "outline-zinc-500/50"
      }`}
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
    >
      <div
        className={`absolute top-2 left-2 z-20 transition-opacity duration-150 ${
          isSelected
            ? "opacity-100"
            : "pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
        }`}
      >
        <div className="gallery-select-control" onClick={(event) => event.stopPropagation()}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={isSelected}
            onChange={handleSelectToggle}
            className="gallery-select-checkbox-input"
            aria-label="Select image"
          />
          <label htmlFor={checkboxId} className="gallery-select-checkbox-label">
            <span className="gallery-select-checkbox-mark" aria-hidden="true">
              <Check className="animate-in h-4 w-4" />
            </span>
          </label>
        </div>
      </div>

      {/* Image */}
      <img
        src={image.thumbnailUrl}
        alt={image.prompt}
        className={`h-auto w-full transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
        width={image.width}
        height={image.height}
      />

      {/* Loading placeholder */}
      {!isLoaded && (
        <div
          className="absolute inset-0 animate-pulse bg-zinc-800"
          style={{
            aspectRatio: image.width && image.height ? `${image.width}/${image.height}` : "1/1",
          }}
        />
      )}

      {/* Persistent model badge */}
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur-sm">
        {image.modelName}
      </div>
    </div>
  );
}
