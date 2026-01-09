import { useState, useCallback } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import type { CompletedGalleryItem } from "~/types";

interface ImageCardProps {
  image: CompletedGalleryItem;
}

export function ImageCard({ image }: ImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const openLightbox = useGalleryStore((s) => s.openLightbox);

  const handleClick = () => {
    openLightbox(image.id);
  };

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      // Set drag data for reference images
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({
          id: image.id,
          blob: image.url,
          name: `${image.modelName} - ${image.prompt.slice(0, 30)}`,
        })
      );
      e.dataTransfer.effectAllowed = "copy";
    },
    [image]
  );

  return (
    <div
      className="group relative rounded-lg overflow-hidden bg-zinc-900 outline-[1.5px] outline-zinc-500/50 cursor-pointer animate-fade-in h-fit"
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
    >
      {/* Image */}
      <img
        src={image.url}
        alt={image.prompt}
        className={`w-full h-auto transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
      />

      {/* Loading placeholder */}
      {!isLoaded && (
        <div
          className="absolute inset-0 bg-zinc-800 animate-pulse"
          style={{
            aspectRatio: image.width && image.height ? `${image.width}/${image.height}` : "1/1",
          }}
        />
      )}

      {/* Persistent model badge */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white/90">
        {image.modelName}
      </div>
    </div>
  );
}
