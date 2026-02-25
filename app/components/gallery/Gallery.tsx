import { useGalleryStore } from "~/stores/galleryStore";
import { GalleryHeader } from "./GalleryHeader";
import { MasonryGrid } from "./MasonryGrid";
import { ImageCard } from "./ImageCard";
import { LoadingCard } from "./LoadingCard";
import { TimelineDivider } from "./TimelineDivider";
import { ImageOff } from "lucide-react";
import type { GalleryItem } from "~/types";

export function Gallery() {
  const items = useGalleryStore((s) => s.items);
  const viewMode = useGalleryStore((s) => s.viewMode);
  const isLoading = useGalleryStore((s) => s.isLoading);

  const itemsByPrompt = groupItemsByPrompt(items);

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
            itemsByPrompt={itemsByPrompt}
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
  itemsByPrompt,
}: {
  itemsByPrompt: Map<string, GalleryItem[]>;
}) {
  const entries = Array.from(itemsByPrompt.entries());

  return (
    <div>
      {entries.map(([promptLabel, promptItems]) => (
        <div key={promptLabel} className="group">
          <TimelineDivider
            dateLabel={formatRelativeDate(getFirstCreatedAt(promptItems))}
            outputCount={promptItems.length}
            prompt={promptLabel}
          />
          <MasonryGrid>
            {promptItems.map((item) => (
              item.status === 'completed' ? (
                <ImageCard key={item.id} image={item} />
              ) : (
                <LoadingCard key={item.id} item={item} />
              )
            ))}
          </MasonryGrid>
        </div>
      ))}
    </div>
  );
}

function groupItemsByPrompt(items: GalleryItem[]): Map<string, GalleryItem[]> {
  const grouped = new Map<string, GalleryItem[]>();

  for (const item of items) {
    const promptKey = item.prompt.trim() || "Untitled prompt";
    const existing = grouped.get(promptKey) || [];
    grouped.set(promptKey, [...existing, item]);
  }

  return grouped;
}

function getFirstCreatedAt(items: GalleryItem[]): number {
  const firstCompleted = items.find((item) => item.status === 'completed');
  return firstCompleted?.createdAt ?? Date.now();
}

function formatRelativeDate(createdAt: number): string {
  const now = Date.now();
  const delta = Math.max(0, now - createdAt);
  const day = 24 * 60 * 60 * 1000;
  const minute = 60 * 1000;
  const hour = 60 * minute;

  if (delta < 30) {
    return 'Just now';
  } else if (delta < minute) {
    return Math.floor(delta / 1000) + ' seconds ago';
  } else if (delta < 2 * minute) {
    return "1 minute ago";
  } else if (delta < hour) {
    return Math.floor(delta / minute) + ' minutes ago';
  } else if (Math.floor(delta / hour) == 1) {
    return "1 hour ago";
  } else if (delta < day) {
    return Math.floor(delta / hour) + ' hours ago.';
  } else if (delta < day * 2) {
    return "Yesterday";
  }

  return new Date(createdAt).toLocaleDateString('en-US');
}
