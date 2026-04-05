import { Check, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGalleryStore } from "~/stores/galleryStore";
import { useEditorStore } from "~/stores/editorStore";
import type { EditorTurn } from "~/types";

interface TurnProps {
  turn: EditorTurn;
  turnIndex: number;
  isFirst?: boolean;
}

export function Turn({ turn, turnIndex, isFirst = false }: TurnProps) {
  const items = useGalleryStore(
    useShallow((s) =>
      turn.itemIds.map((id) => s.items.find((item) => item.id === id)).filter(Boolean)
    )
  ) as ReturnType<typeof useGalleryStore.getState>["items"];

  const selectedItemId = useEditorStore((s) => s.selectedItemId);
  const selectItem = useEditorStore((s) => s.selectItem);
  const sourceBlob = useEditorStore((s) => s.sourceBlob);
  const turns = useEditorStore((s) => s.turns);

  // Source thumbnail URL: comes from the item used as reference, or source blob
  const [sourceThumbUrl, setSourceThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (turn.sourceItemId) {
      // Get from gallery store directly
      const item = useGalleryStore.getState().items.find((i) => i.id === turn.sourceItemId);
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
  }, [turn.sourceItemId, turn.sourceBlob]);

  // Auto-select the first completed item in the most recent turn
  const isLastTurn = turnIndex === turns.length - 1;
  useEffect(() => {
    if (!isLastTurn) return;
    const firstCompleted = items.find((item) => item?.status === "completed");
    if (firstCompleted && !selectedItemId) {
      selectItem(firstCompleted.id);
    }
  }, [items, isLastTurn, selectedItemId, selectItem]);

  return (
    <div className="animate-fade-in">
      {/* Turn header */}
      <div className="mb-3 flex items-start gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {!isFirst && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[10px] font-medium text-zinc-500">
              {turnIndex + 1}
            </span>
          )}
          <p className="truncate text-sm leading-snug font-medium text-zinc-200">
            {turn.instruction}
          </p>
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
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => {
          if (!item) return null;

          if (item.status === "completed") {
            const isSelected = selectedItemId === item.id;
            return (
              <EditorImageCard
                key={item.id}
                thumbnailUrl={item.thumbnailUrl}
                modelName={item.modelName}
                isSelected={isSelected}
                onClick={() => selectItem(isSelected ? null : item.id)}
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
}: {
  thumbnailUrl: string;
  modelName: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

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

      {/* Selection checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

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
  const modelName = item.modelName;

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-zinc-800"
      style={{ aspectRatio: "1/1" }}
    >
      {!isFailed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-full w-full animate-pulse bg-zinc-800" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-500/60"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-950/30 p-3">
          <p className="line-clamp-3 text-center text-xs leading-snug text-red-300">
            {item.error || "Generation failed"}
          </p>
        </div>
      )}

      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white/70 backdrop-blur-sm">
        {modelName}
      </div>
    </div>
  );
}
