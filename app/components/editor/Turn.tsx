import { Check, Layers2, Link2, Maximize2, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useEditorStore } from "~/stores/editorStore";
import { useLightboxStore } from "~/stores/lightboxStore";
import { useDiffStore } from "~/stores/diffStore";
import type { EditorTurn } from "~/types";
import { SineWaveGrid } from "~/components/gallery/SineWaveGrid";
import { useGalleryDerivedIndexes } from "~/hooks/useGalleryDerivedIndexes";
import { getAspectRatioValue } from "~/lib/util";

interface TurnProps {
  turn: EditorTurn;
  turnIndex: number;
  isFirst?: boolean;
}

export function Turn({ turn, turnIndex, isFirst = false }: TurnProps) {
  const { getItemById } = useGalleryDerivedIndexes();
  const items = useMemo(
    () => turn.itemIds.map((id) => getItemById(id)).filter(Boolean),
    [getItemById, turn.itemIds]
  ) as ReturnType<typeof useGalleryStore.getState>["items"];

  const selectedItemId = useEditorStore((s) => s.selectedItemId);
  const selectItem = useEditorStore((s) => s.selectItem);
  const turns = useEditorStore((s) => s.turns);

  // Source thumbnail URL: comes from the item used as reference, or source blob
  const [sourceThumbUrl, setSourceThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (turn.sourceItemId) {
      const item = getItemById(turn.sourceItemId);
      if (item && item.status === "completed") {
        setSourceThumbUrl(item.thumbnailUrl);
      }
    } else {
      // Use source blob
      if (turn.sourceBlob) {
        const url = URL.createObjectURL(turn.sourceBlob);
        setSourceThumbUrl(url);
        return () => URL.revokeObjectURL(url);
      }
    }
  }, [getItemById, turn.sourceItemId, turn.sourceBlob]);

  // Parent blob (for diff viewer): either the source gallery item's full-res blob,
  // or the original source blob if this turn edits the original.
  const { parentBlob, parentLabel } = useMemo(() => {
    if (turn.sourceItemId) {
      const item = getItemById(turn.sourceItemId);
      if (item && item.status === "completed") {
        return { parentBlob: item.originalBlob, parentLabel: item.modelName };
      }
      return { parentBlob: null, parentLabel: undefined };
    }
    return { parentBlob: turn.sourceBlob ?? null, parentLabel: "Source" };
  }, [getItemById, turn.sourceItemId, turn.sourceBlob]);

  // Auto-select the first completed item in the most recent turn (once only)
  const isLastTurn = turnIndex === turns.length - 1;
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (!isLastTurn) return;
    if (hasAutoSelectedRef.current) return;
    const firstCompleted = items.find((item) => item?.status === "completed");
    if (firstCompleted && !selectedItemId) {
      selectItem(firstCompleted.id);
      hasAutoSelectedRef.current = true;
    }
  }, [items, isLastTurn, selectedItemId, selectItem]);

  if (items.filter(Boolean).length === 0) return null;

  return (
    <div className="animate-fade-in flex w-full flex-col items-center">
      {/* Turn header */}
      <div className="mb-1 flex w-full max-w-4xl items-start gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <p className="text-sm leading-snug font-medium text-zinc-200">{turn.instruction}</p>
        </div>

        {/* Source thumbnail */}
        {sourceThumbUrl && (
          <div className="flex shrink-0 items-center gap-1.5">
            <Link2 className="h-3 w-3 text-zinc-600" />
            <div className="h-8 w-8 overflow-hidden rounded-md border border-zinc-700 bg-zinc-800">
              <img src={sourceThumbUrl} alt="source" className="h-full w-full object-cover" />
            </div>
          </div>
        )}
      </div>

      {/* Image grid */}
      <div className="grid w-full max-w-4xl grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 p-3">
        {items.map((item) => {
          if (!item) return null;

          if (item.status === "completed") {
            const isSelected = selectedItemId === item.id;
            return (
              <EditorImageCard
                key={item.id}
                itemId={item.id}
                thumbnailUrl={item.thumbnailUrl}
                modelName={item.modelName}
                isSelected={isSelected}
                onClick={() => selectItem(item.id)}
                childBlob={item.originalBlob}
                parentBlob={parentBlob}
                parentLabel={parentLabel}
              />
            );
          }

          return <EditorLoadingCard key={item.id} item={item} />;
        })}
      </div>
    </div>
  );
}

function EditorImageCard({
  thumbnailUrl,
  modelName,
  isSelected,
  onClick,
  itemId,
  childBlob,
  parentBlob,
  parentLabel,
}: {
  thumbnailUrl: string;
  modelName: string;
  isSelected: boolean;
  onClick: () => void;
  itemId: string;
  childBlob: Blob;
  parentBlob: Blob | null;
  parentLabel?: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const openLightbox = useLightboxStore((s) => s.openLightbox);
  const openDiff = useDiffStore((s) => s.openDiff);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative cursor-pointer overflow-hidden rounded-lg bg-zinc-800 transition-all duration-150 ${
        isSelected
          ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-950"
          : "ring-1 ring-zinc-700/50 hover:ring-zinc-600"
      }`}
    >
      <img
        src={thumbnailUrl}
        alt={modelName}
        className={`h-auto w-full transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setIsLoaded(true)}
      />
      {!isLoaded && (
        <div
          className="absolute inset-0 animate-pulse bg-zinc-800"
          style={{ aspectRatio: "1/1" }}
        />
      )}

      {/* Model badge */}
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white/80 backdrop-blur-sm">
        {modelName}
      </div>

      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
        {/* Selection indicator (always visible) */}
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-md backdrop-blur-sm ${
            isSelected ? "bg-purple-500" : "bg-black/60"
          }`}
        >
          {isSelected ? (
            <Check className="h-4 w-4 text-white" />
          ) : (
            <Square className="h-4 w-4 text-white/80" />
          )}
        </div>

        {/* Maximize button (hover only) */}
        <div
          className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            openLightbox({ kind: "gallery", imageId: itemId });
          }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 backdrop-blur-sm">
            <Maximize2 className="h-4 w-4 text-white/80" />
          </div>
        </div>

        {/* Diff button (hover only) */}
        {parentBlob && (
          <div
            className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              openDiff({
                parentBlob,
                childBlob,
                parentLabel,
                childLabel: modelName,
              });
            }}
            title="Compare with source"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 backdrop-blur-sm">
              <Layers2 className="h-4 w-4 text-white/80" />
            </div>
          </div>
        )}
      </div>

      {/* Hover overlay hint when not selected */}
      {!isSelected && (
        <div className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/5" />
      )}
    </button>
  );
}

function EditorLoadingCard({
  item,
}: {
  item: ReturnType<typeof useGalleryStore.getState>["items"][number];
}) {
  const isFailed = item.status === "failed";
  const isWaiting = item.status === "waiting";
  const isGenerating = item.status === "generating" || item.status === "pending";

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800"
      style={{ aspectRatio: getAspectRatioValue(item.aspectRatio) }}
    >
      {isGenerating && <SineWaveGrid />}
      {isWaiting && <SineWaveGrid frozen />}
      {isFailed && <div className="absolute inset-0 bg-red-950/30" />}

      {isGenerating && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-xs font-medium text-white/80 drop-shadow-lg">Generating...</p>
        </div>
      )}

      {isWaiting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
          <p className="text-xs font-medium text-white/70">Rate limited</p>
        </div>
      )}

      {isFailed && (
        <div className="absolute inset-0 flex items-center justify-center p-3">
          <p className="line-clamp-3 text-center text-xs leading-snug text-red-300">
            {item.error || "Generation failed"}
          </p>
        </div>
      )}

      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white/70 backdrop-blur-sm">
        {item.modelName}
      </div>
    </div>
  );
}
