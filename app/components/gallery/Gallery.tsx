import { useState } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { GalleryHeader } from "./GalleryHeader";
import { MasonryGrid } from "./MasonryGrid";
import { ImageCard } from "./ImageCard";
import { LoadingCard } from "./LoadingCard";
import { TimelineDivider } from "./TimelineDivider";
import { ImageOff, Paperclip, Download, Trash2, X } from "lucide-react";
import type { GalleryItem } from "~/types";

export function Gallery() {
  const items = useGalleryStore((s) => s.items);
  const viewMode = useGalleryStore((s) => s.viewMode);
  const isLoading = useGalleryStore((s) => s.isLoading);
  const selectedCount = useGalleryStore((s) => s.selectedItemIds.length);

  const itemsByPrompt = groupItemsByPrompt(items);

  const totalCount = items.length;

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-zinc-500">Loading images...</div>
      </main>
    );
  }

  return (
    <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-zinc-950">
      <GalleryHeader count={totalCount} />

      <div className={`flex-1 overflow-y-auto p-6 ${selectedCount > 0 ? "pb-28" : ""}`}>
        {totalCount === 0 ? (
          <EmptyState />
        ) : viewMode === "grid" ? (
          <GridView items={items} />
        ) : (
          <TimelineView itemsByPrompt={itemsByPrompt} />
        )}
      </div>

      <SelectionActionPopup />
    </main>
  );
}

function SelectionActionPopup() {
  const selectedCount = useGalleryStore((s) => s.selectedItemIds.length);
  const clearSelection = useGalleryStore((s) => s.clearSelection);
  const deleteSelectedItems = useGalleryStore((s) => s.deleteSelectedItems);
  const downloadSelectedItems = useGalleryStore((s) => s.downloadSelectedItems);
  const attachSelectedItemsToPrompt = useGalleryStore((s) => s.attachSelectedItemsToPrompt);
  const [isDeleting, setIsDeleting] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleAttachSelected = () => {
    const result = attachSelectedItemsToPrompt();
    if (!result.success && result.reason) {
      alert(result.reason);
    }
  };

  const handleDeleteSelected = async () => {
    if (isDeleting) return;
    if (!confirm(`Delete ${selectedCount} selected image${selectedCount === 1 ? "" : "s"}?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteSelectedItems();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-6">
      <div className="animate-slide-up pointer-events-auto flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <span className="mr-1 text-xs font-medium text-zinc-300">{selectedCount} selected</span>

        <PopupActionButton
          icon={<X className="h-3.5 w-3.5" />}
          label="Deselect all"
          onClick={clearSelection}
        />

        <PopupActionButton
          icon={<Paperclip className="h-3.5 w-3.5" />}
          label="Attach"
          onClick={handleAttachSelected}
        />
        <PopupActionButton
          icon={<Download className="h-3.5 w-3.5" />}
          label="Download"
          onClick={downloadSelectedItems}
        />
        <PopupActionButton
          icon={<Trash2 className="h-3.5 w-3.5" />}
          label={isDeleting ? "Deleting..." : "Delete"}
          onClick={() => {
            void handleDeleteSelected();
          }}
          variant="danger"
        />
      </div>
    </div>
  );
}

function PopupActionButton({
  icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
        variant === "danger"
          ? "text-red-300 hover:bg-red-500/10"
          : "text-zinc-200 hover:bg-zinc-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
        <ImageOff className="h-8 w-8 text-zinc-600" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-zinc-300">No images yet</h3>
      <p className="max-w-xs text-sm text-zinc-500">
        Enter a prompt, select a model, and click Generate to create your first image.
      </p>
    </div>
  );
}

function GridView({ items }: { items: ReturnType<typeof useGalleryStore.getState>["items"] }) {
  return (
    <MasonryGrid>
      {items.map((item) => {
        // Render appropriate card type based on status
        if (item.status === "completed") {
          return <ImageCard key={item.id} image={item} />;
        } else {
          // pending, generating, or failed
          return <LoadingCard key={item.id} item={item} />;
        }
      })}
    </MasonryGrid>
  );
}

function TimelineView({ itemsByPrompt }: { itemsByPrompt: Map<string, GalleryItem[]> }) {
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
            {promptItems.map((item) =>
              item.status === "completed" ? (
                <ImageCard key={item.id} image={item} />
              ) : (
                <LoadingCard key={item.id} item={item} />
              )
            )}
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
  const firstCompleted = items.find((item) => item.status === "completed");
  return firstCompleted?.createdAt ?? Date.now();
}

function formatRelativeDate(createdAt: number): string {
  const now = Date.now();
  const delta = Math.max(0, now - createdAt);
  const day = 24 * 60 * 60 * 1000;
  const minute = 60 * 1000;
  const hour = 60 * minute;

  if (delta < 30) {
    return "Just now";
  } else if (delta < minute) {
    return Math.floor(delta / 1000) + " seconds ago";
  } else if (delta < 2 * minute) {
    return "1 minute ago";
  } else if (delta < hour) {
    return Math.floor(delta / minute) + " minutes ago";
  } else if (Math.floor(delta / hour) == 1) {
    return "1 hour ago";
  } else if (delta < day) {
    return Math.floor(delta / hour) + " hours ago";
  } else if (delta < day * 2) {
    return "Yesterday";
  }

  return new Date(createdAt).toLocaleDateString("en-US");
}
