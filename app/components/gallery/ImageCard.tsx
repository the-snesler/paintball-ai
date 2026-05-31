import { Check, Play, Star } from "lucide-react";
import { useState, useCallback, type ChangeEvent, type MouseEvent } from "react";
import { getScorecardAverage } from "~/lib/scorecard";
import { useGalleryStore } from "~/stores/galleryStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import type { CompletedGalleryItem } from "~/types";

interface ImageCardProps {
  image: CompletedGalleryItem;
  selectionDisabled?: boolean;
}

export function ImageCard({ image, selectionDisabled = false }: ImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const isVideo = image.originalBlob.type.startsWith("video/");
  const openLightbox = useLightboxStore((s) => s.openLightbox);
  const selectedItemIds = useGalleryStore((s) => s.selectedItemIds);
  const toggleItemSelection = useGalleryStore((s) => s.toggleItemSelection);
  const selectItemRange = useGalleryStore((s) => s.selectItemRange);
  const isSelected = !selectionDisabled && selectedItemIds.includes(image.id);
  const checkboxId = `gallery-select-${image.id}`;
  const scoreAverage = getScorecardAverage(image.scorecard);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!selectionDisabled) {
      if (event.shiftKey) {
        event.preventDefault();
        selectItemRange(image.id);
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        toggleItemSelection(image.id);
        return;
      }
    }

    openLightbox({ kind: "gallery", imageId: image.id });
  };

  const handleSelectToggle = (event: ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    toggleItemSelection(image.id);
  };

  const handleSelectControlClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.shiftKey) {
      event.preventDefault();
      selectItemRange(image.id);
    }
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
      className={`group animate-fade-in bg-surface-raised relative h-fit cursor-pointer overflow-hidden rounded-lg outline-[1.5px] ${
        isSelected ? "outline-purple-500" : "outline-c-border/50"
      }`}
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
    >
      {!selectionDisabled && (
        <div
          className={`absolute top-2 left-2 z-20 transition-opacity duration-150 ${
            isSelected
              ? "opacity-100"
              : "pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
          }`}
        >
          <div className="gallery-select-control" onClick={handleSelectControlClick}>
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
      )}

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
          className="bg-surface-overlay absolute inset-0 animate-pulse"
          style={{
            aspectRatio: image.width && image.height ? `${image.width}/${image.height}` : "1/1",
          }}
        />
      )}

      {/* Video play indicator */}
      {isVideo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
      )}

      {/* Persistent model badge */}
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur-sm">
        {image.modelName}
      </div>
      {image.isFavorite && (
        <div className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-yellow-300 backdrop-blur-sm">
          <Star className="h-4 w-4 fill-current" />
        </div>
      )}
      {scoreAverage != null && (
        <div className="text-accent-muted absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-xs backdrop-blur-sm">
          <Star className="h-3 w-3 fill-current" />
          {scoreAverage.toFixed(1)}
        </div>
      )}
    </div>
  );
}
