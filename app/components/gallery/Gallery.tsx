import { useGalleryStore } from "~/stores/galleryStore";
import { GalleryHeader } from "./GalleryHeader";
import { MasonryGrid } from "./MasonryGrid";
import { ImageCard } from "./ImageCard";
import { LoadingCard } from "./LoadingCard";
import { TimelineDivider } from "./TimelineDivider";
import { ImageOff } from "lucide-react";
import type { CompletedGalleryItem, FailedGalleryItem, PendingGalleryItem } from "~/types";

export function Gallery() {
  const items = useGalleryStore((s) => s.items);
  const viewMode = useGalleryStore((s) => s.viewMode);
  const isLoading = useGalleryStore((s) => s.isLoading);
  const getItemsByDate = useGalleryStore((s) => s.getItemsByDate);

  // Filter items by status
  const pendingItems = items.filter((i) => i.status === 'pending' || i.status === 'generating') as PendingGalleryItem[];
  const failedItems = items.filter((i) => i.status === 'failed') as FailedGalleryItem[];

  const totalCount = items.length;

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
          <GridView items={items} />
        ) : (
          <TimelineView
            itemsByDate={getItemsByDate()}
            pendingItems={pendingItems}
            failedItems={failedItems}
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
  items,
}: {
  items: ReturnType<typeof useGalleryStore.getState>["items"];
}) {
  return (
    <MasonryGrid>
      {items.map((item) => {
        // Render appropriate card type based on status
        if (item.status === 'completed') {
          return <ImageCard key={item.id} image={item} />;
        } else {
          // pending, generating, or failed
          return <LoadingCard key={item.id} item={item} />;
        }
      })}
    </MasonryGrid>
  );
}

function TimelineView({
  itemsByDate,
  pendingItems,
  failedItems,
}: {
  itemsByDate: Map<string, CompletedGalleryItem[]>;
  pendingItems: PendingGalleryItem[];
  failedItems: FailedGalleryItem[];
}) {
  const entries = Array.from(itemsByDate.entries());
  const hasActiveGenerations = pendingItems.length > 0 || failedItems.length > 0;

  return (
    <div>
      {/* Show pending/generating/failed items at the top */}
      {hasActiveGenerations && (
        <>
          <TimelineDivider label="Generating..." />
          <MasonryGrid>
            {pendingItems.map((item) => (
              <LoadingCard key={item.id} item={item} />
            ))}
            {failedItems.map((item) => (
              <LoadingCard key={item.id} item={item} />
            ))}
          </MasonryGrid>
        </>
      )}

      {/* Show completed items grouped by date */}
      {entries.map(([dateLabel, dateItems]) => (
        <div key={dateLabel}>
          <TimelineDivider label={dateLabel} />
          <MasonryGrid>
            {dateItems.map((item) => (
              <ImageCard key={item.id} image={item} />
            ))}
          </MasonryGrid>
        </div>
      ))}
    </div>
  );
}
