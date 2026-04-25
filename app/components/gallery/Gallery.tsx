import { useState, useEffect, useRef, useMemo } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { GalleryHeader } from "./GalleryHeader";
import { MasonryGrid, MasonryFrame } from "./MasonryGrid";
import { GalleryImageCard } from "./GalleryImageCard";
import { TimelineDivider } from "./TimelineDivider";
import { ImageOff, Download, Trash2, X, ImagePlus } from "lucide-react";
import type { GalleryItem } from "~/types";
import { formatRelativeDate } from "~/lib/util";
import { getFirstCreatedAt, groupItemsByPrompt } from "~/lib/galleryGrouping";
import { stripVariationSections } from "~/lib/promptVariations";
import { cosine } from "~/lib/embeddingMath";
import NumberFlow from "@number-flow/react";
import { useAttachSelectedItemsToGeneration } from "~/hooks/useAttachSelectedItemsToGeneration";
import { useGalleryDerivedIndexes } from "~/hooks/useGalleryDerivedIndexes";
import { useQueryEmbedding } from "~/hooks/useQueryEmbedding";
import { logger } from "~/lib/logging";

const SEMANTIC_THRESHOLD = 0.1;

export function Gallery({ viewMode }: { viewMode: "grid" | "timeline" }) {
  const items = useGalleryStore((s) => s.items);
  const isLoading = useGalleryStore((s) => s.isLoading);
  const selectedCount = useGalleryStore((s) => s.selectedItemIds.length);
  const hasMore = useGalleryStore((s) => s.hasMore);
  const isLoadingMore = useGalleryStore((s) => s.isLoadingMore);
  const loadMoreImages = useGalleryStore((s) => s.loadMoreImages);
  const totalCount = useGalleryStore((s) => s.totalCount);
  const searchQuery = useGalleryStore((s) => s.searchQuery);
  const setSearchQuery = useGalleryStore((s) => s.setSearchQuery);
  const semanticSearchEnabled = useSettingsStore((s) => s.semanticSearchEnabled);
  const { itemsByPrompt } = useGalleryDerivedIndexes();

  const queryEmbedding = useQueryEmbedding(searchQuery, semanticSearchEnabled);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.trim().toLowerCase();
    const substringMatches = items.filter(
      (item) =>
        item.prompt.toLowerCase().includes(q) ||
        (item.basePrompt?.toLowerCase().includes(q) ?? false) ||
        item.modelName.toLowerCase().includes(q)
    );

    logger.debug("Substring search results", {
      query: searchQuery,
      count: substringMatches.length,
    });

    if (!semanticSearchEnabled || !queryEmbedding) return substringMatches;

    const substringIds = new Set(substringMatches.map((i) => i.id));
    const semanticMatches: GalleryItem[] = [];
    const scored: Array<{ item: GalleryItem; score: number }> = [];
    for (const item of items) {
      if (item.status !== "completed") continue;
      if (!item.embedding || item.embedding.length === 0) continue;
      const score = cosine(queryEmbedding, item.embedding);
      if (score >= SEMANTIC_THRESHOLD) scored.push({ item, score });
      if (substringIds.has(item.id) && score < SEMANTIC_THRESHOLD) scored.push({ item, score });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const { item } of scored) semanticMatches.push(item);

    logger.debug("Merged search results", {
      query: searchQuery,
      count: semanticMatches.length,
    });

    return semanticMatches;
  }, [items, searchQuery, semanticSearchEnabled, queryEmbedding]);

  const filteredItemsByPrompt = useMemo(
    () => (searchQuery.trim() ? groupItemsByPrompt(filteredItems) : itemsByPrompt),
    [filteredItems, itemsByPrompt, searchQuery]
  );

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreImages();
      },
      { rootMargin: "200px", scrollMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMoreImages]);

  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="text-text-muted">Loading images...</div>
      </main>
    );
  }

  return (
    <main className="relative flex h-full flex-1 flex-col overflow-hidden bg-surface">
      <GalleryHeader
        count={searchQuery.trim() ? filteredItems.length : totalCount}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className={`flex-1 overflow-y-auto p-2 md:p-6 ${selectedCount > 0 ? "pb-28" : ""}`}>
        {filteredItems.length === 0 ? (
          searchQuery.trim() ? (
            <NoSearchResults />
          ) : (
            <EmptyState />
          )
        ) : viewMode === "grid" ? (
          <GridView items={filteredItems} />
        ) : (
          <TimelineView itemsByPrompt={filteredItemsByPrompt} />
        )}

        <div ref={sentinelRef} className="h-1" />
        {isLoadingMore && (
          <div className="flex justify-center py-6 text-xs text-text-muted">Loading more...</div>
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
  const attachSelectedItemsToGeneration = useAttachSelectedItemsToGeneration();
  const [isDeleting, setIsDeleting] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleAttachSelected = () => {
    const result = attachSelectedItemsToGeneration();
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
      <div className="animate-slide-up pointer-events-auto flex items-center gap-2 rounded-xl border border-c-border bg-surface-raised/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <span className="mr-1 text-xs font-medium text-text-secondary">
          <NumberFlow value={selectedCount} className="text-xs font-medium text-text-secondary" />{" "}
          selected
        </span>

        <PopupActionButton
          icon={<X className="h-3.5 w-3.5" />}
          label="Deselect all"
          onClick={clearSelection}
        />

        <PopupActionButton
          icon={<ImagePlus className="h-3.5 w-3.5" />}
          label="Attach to prompt"
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
          : "text-text-secondary hover:bg-surface-overlay"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function NoSearchResults() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
        <ImageOff className="h-8 w-8 text-text-muted" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-text-secondary">No results</h3>
      <p className="max-w-xs text-sm text-text-muted">
        No images match your search. Try a different prompt or model name.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
        <ImageOff className="h-8 w-8 text-text-muted" />
      </div>
      <h3 className="mb-2 text-lg font-medium text-text-secondary">No images yet</h3>
      <p className="max-w-xs text-sm text-text-muted">
        Enter a prompt, select a model, and click Generate to create your first image.
      </p>
    </div>
  );
}

function getFrameDimensions(item: GalleryItem): { width: number; height: number } {
  if (item.status === "completed") {
    return { width: item.width, height: item.height };
  }
  if (item.aspectRatio) {
    const [w, h] = item.aspectRatio.split(":").map(Number);
    if (w && h) return { width: w, height: h };
  }
  return { width: 1, height: 1 };
}

function GridView({ items }: { items: ReturnType<typeof useGalleryStore.getState>["items"] }) {
  return (
    <MasonryGrid>
      {items.map((item) => {
        const { width, height } = getFrameDimensions(item);
        return (
          <MasonryFrame key={item.id} width={width} height={height}>
            <GalleryImageCard item={item} />
          </MasonryFrame>
        );
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
            prompt={stripVariationSections(promptLabel)}
          />
          <MasonryGrid>
            {promptItems.map((item) => {
              const { width, height } = getFrameDimensions(item);
              return (
                <MasonryFrame key={item.id} width={width} height={height}>
                  <GalleryImageCard item={item} />
                </MasonryFrame>
              );
            })}
          </MasonryGrid>
        </div>
      ))}
    </div>
  );
}
