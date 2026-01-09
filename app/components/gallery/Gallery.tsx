import { useGalleryStore } from "~/stores/galleryStore";
import { useGenerationStore } from "~/stores/generationStore";
import { GalleryHeader } from "./GalleryHeader";
import { MasonryGrid } from "./MasonryGrid";
import { ImageCard } from "./ImageCard";
import { LoadingCard } from "./LoadingCard";
import { TimelineDivider } from "./TimelineDivider";
import { ImageOff } from "lucide-react";

export function Gallery() {
  const images = useGalleryStore((s) => s.images);
  const viewMode = useGalleryStore((s) => s.viewMode);
  const isLoading = useGalleryStore((s) => s.isLoading);
  const pendingGenerations = useGenerationStore((s) => s.pendingGenerations);
  const getImagesByDate = useGalleryStore((s) => s.getImagesByDate);

  const totalCount = images.length + pendingGenerations.length;

  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-zinc-500">Loading images...</div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
      <GalleryHeader count={totalCount} />

      <div className="flex-1 overflow-y-auto p-6">
        {totalCount === 0 ? (
          <EmptyState />
        ) : viewMode === "grid" ? (
          <GridView images={images} pendingGenerations={pendingGenerations} />
        ) : (
          <TimelineView
            imagesByDate={getImagesByDate()}
            pendingGenerations={pendingGenerations}
          />
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
        <ImageOff className="w-8 h-8 text-zinc-600" />
      </div>
      <h3 className="text-lg font-medium text-zinc-300 mb-2">No images yet</h3>
      <p className="text-sm text-zinc-500 max-w-xs">
        Enter a prompt, select a model, and click Generate to create your first image.
      </p>
    </div>
  );
}

function GridView({
  images,
  pendingGenerations,
}: {
  images: ReturnType<typeof useGalleryStore.getState>["images"];
  pendingGenerations: ReturnType<typeof useGenerationStore.getState>["pendingGenerations"];
}) {
  return (
    <MasonryGrid>
      {pendingGenerations.map((pending) => (
        <LoadingCard key={pending.id} generation={pending} />
      ))}
      {images.map((image) => (
        <ImageCard key={image.id} image={image} />
      ))}
    </MasonryGrid>
  );
}

function TimelineView({
  imagesByDate,
  pendingGenerations,
}: {
  imagesByDate: Map<string, ReturnType<typeof useGalleryStore.getState>["images"]>;
  pendingGenerations: ReturnType<typeof useGenerationStore.getState>["pendingGenerations"];
}) {
  const entries = Array.from(imagesByDate.entries());

  return (
    <div>
      {/* Show pending generations at the top */}
      {pendingGenerations.length > 0 && (
        <>
          <TimelineDivider label="Generating..." />
          <MasonryGrid>
            {pendingGenerations.map((pending) => (
              <LoadingCard key={pending.id} generation={pending} />
            ))}
          </MasonryGrid>
        </>
      )}

      {/* Show images grouped by date */}
      {entries.map(([dateLabel, dateImages]) => (
        <div key={dateLabel}>
          <TimelineDivider label={dateLabel} />
          <MasonryGrid>
            {dateImages.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
          </MasonryGrid>
        </div>
      ))}
    </div>
  );
}
