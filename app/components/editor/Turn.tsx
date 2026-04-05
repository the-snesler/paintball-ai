import { Check, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useEditorStore } from "~/stores/editorStore";
import type { EditorTurn } from "~/types";

interface TurnProps {
  turn: EditorTurn;
  turnIndex: number;
  isFirst?: boolean;
}

export function Turn({ turn, turnIndex, isFirst = false }: TurnProps) {
  const items = useGalleryStore((s) =>
    turn.itemIds
      .map((id) => s.items.find((item) => item.id === id))
      .filter(Boolean)
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
      const item = useGalleryStore
        .getState()
        .items.find((i) => i.id === turn.sourceItemId);
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
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {!isFirst && (
            <span className="shrink-0 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-medium text-zinc-500">
              {turnIndex + 1}
            </span>
          )}
          <p className="text-sm font-medium text-zinc-200 leading-snug truncate">
            {turn.instruction}
          </p>
        </div>

        {/* Source thumbnail */}
        {sourceThumbUrl && (
          <div className="shrink-0 flex items-center gap-1.5">
            <Link2 className="w-3 h-3 text-zinc-600" />
            <div className="w-8 h-8 rounded-md overflow-hidden border border-zinc-700 bg-zinc-800">
              <img
                src={sourceThumbUrl}
                alt="source"
                className="w-full h-full object-cover"
              />
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
      className={`relative rounded-lg overflow-hidden bg-zinc-800 cursor-pointer transition-all duration-150 group ${
        isSelected
          ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-950"
          : "ring-1 ring-zinc-700/50 hover:ring-zinc-600"
      }`}
    >
      <img
        src={thumbnailUrl}
        alt={modelName}
        className={`w-full h-auto transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setIsLoaded(true)}
      />
      {!isLoaded && <div className="absolute inset-0 bg-zinc-800 animate-pulse" style={{ aspectRatio: "1/1" }} />}

      {/* Model badge */}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-xs text-white/80">
        {modelName}
      </div>

      {/* Selection checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Hover overlay hint when not selected */}
      {!isSelected && (
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
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
      className="relative rounded-lg overflow-hidden bg-zinc-900 ring-1 ring-zinc-800"
      style={{ aspectRatio: "1/1" }}
    >
      {!isFailed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full bg-zinc-800 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-purple-500/60 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="absolute inset-0 bg-red-950/30 flex items-center justify-center p-3">
          <p className="text-xs text-red-300 text-center leading-snug line-clamp-3">
            {item.error || "Generation failed"}
          </p>
        </div>
      )}

      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded text-xs text-white/70">
        {modelName}
      </div>
    </div>
  );
}
