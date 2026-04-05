import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useEditorStore } from "~/stores/editorStore";
import { useGalleryStore } from "~/stores/galleryStore";
import { Turn } from "./Turn";

export function TurnList() {
  const turns = useEditorStore((s) => s.turns);
  const sourceUrl = useEditorStore((s) => s.sourceUrl);
  const sourcePrompt = useEditorStore((s) => s.sourcePrompt);
  const selectedItemId = useEditorStore((s) => s.selectedItemId);
  const selectItem = useEditorStore((s) => s.selectItem);

  const scrollRef = useRef<HTMLDivElement>(null);
  const prevTurnCountRef = useRef(turns.length);

  // Auto-scroll to bottom when new turns are added
  useEffect(() => {
    if (turns.length > prevTurnCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    prevTurnCountRef.current = turns.length;
  }, [turns.length]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-6">
        {/* Source image "turn zero" */}
        {sourceUrl && (
          <SourceTurn
            url={sourceUrl}
            prompt={sourcePrompt}
            isSelected={selectedItemId === null}
            onSelect={() => selectItem(null)}
          />
        )}

        {/* Edit turns */}
        {turns.map((turn, index) => (
          <div key={turn.id} className="relative border-l border-zinc-800 pl-4">
            <Turn turn={turn} turnIndex={index} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceTurn({
  url,
  prompt,
  isSelected,
  onSelect,
}: {
  url: string;
  prompt: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const reset = useEditorStore((s) => s.reset);

  // Get source item from gallery if available
  const sourceGalleryItemId = useEditorStore((s) => s.sourceGalleryItemId);
  const galleryItem = useGalleryStore((s) =>
    sourceGalleryItemId ? s.items.find((i) => i.id === sourceGalleryItemId) : null
  );
  const displayUrl =
    galleryItem && galleryItem.status === "completed" ? galleryItem.thumbnailUrl : url;

  return (
    <div className="animate-fade-in">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-medium tracking-wider text-zinc-600 uppercase">Source</span>
        <button
          onClick={reset}
          className="rounded p-1 text-zinc-700 transition-colors hover:bg-red-500/10 hover:text-red-400"
          title="Clear editor"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <button
        type="button"
        onClick={onSelect}
        className={`group relative max-w-xs cursor-pointer overflow-hidden rounded-lg transition-all duration-150 ${
          isSelected
            ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-zinc-950"
            : "ring-1 ring-zinc-700/50 hover:ring-zinc-600"
        }`}
      >
        <img
          src={displayUrl}
          alt={prompt || "Source image"}
          className={`h-auto w-full transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setIsLoaded(true)}
        />
        {!isLoaded && (
          <div
            className="absolute inset-0 animate-pulse bg-zinc-800"
            style={{ minHeight: "200px" }}
          />
        )}

        {isSelected && (
          <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500">
            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}

        {!isSelected && (
          <div className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/5" />
        )}

        {prompt && (
          <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <p className="line-clamp-2 text-xs leading-snug text-white/80">{prompt}</p>
          </div>
        )}
      </button>
    </div>
  );
}
