import { Pencil, X } from "lucide-react";
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { AspectRatioPreview } from "~/components/ui/AspectRatioPreview";
import { simplifyImageAspectRatio } from "~/lib/models";

interface SortableReferenceImageProps {
  img: { id: string; url: string; name: string };
  onRemove: (id: string) => void;
  onOpen: (img: { id: string; url: string; name: string }) => void;
  onEdit: (id: string) => void;
  onMatchAspectRatio?: (ratio: string) => void;
  maxLongShortRatio?: number;
  referenceEnabled?: boolean;
}

export function SortableReferenceImage({
  img,
  onRemove,
  onOpen,
  onEdit,
  onMatchAspectRatio,
  maxLongShortRatio = Infinity,
  referenceEnabled = true,
}: SortableReferenceImageProps) {
  const [dimensions, setDimensions] = useState({ url: "", width: 0, height: 0 });
  const hasDimensions = dimensions.url === img.url && dimensions.width > 0 && dimensions.height > 0;
  const ratioAllowed =
    hasDimensions &&
    Math.max(dimensions.width, dimensions.height) / Math.min(dimensions.width, dimensions.height) <=
      maxLongShortRatio;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: DndCSS.Transform.toString(transform),
        transition,
      }}
      className={`group relative aspect-square ${isDragging ? "z-50 opacity-75" : ""}`}
    >
      <button
        type="button"
        onClick={() => onOpen(img)}
        className="block h-full w-full cursor-zoom-in"
        {...attributes}
        {...listeners}
      >
        <img
          src={img.url}
          alt={img.name}
          onLoad={(e) =>
            setDimensions({
              url: img.url,
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            })
          }
          className="h-full w-full rounded object-cover"
        />
      </button>
      <div className="border-c-border bg-surface-raised absolute -top-1 -right-1 flex h-5 overflow-hidden rounded-full border opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {onMatchAspectRatio && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (!ratioAllowed) return;
              onMatchAspectRatio(
                simplifyImageAspectRatio(dimensions.width, dimensions.height, maxLongShortRatio)
              );
            }}
            disabled={!referenceEnabled || !ratioAllowed}
            className="text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary border-c-border/70 flex h-full w-5 items-center justify-center border-r disabled:cursor-not-allowed disabled:opacity-40"
            title={
              hasDimensions && !ratioAllowed
                ? `Reference aspect ratio exceeds the model's ${maxLongShortRatio}:1 limit`
                : "Match reference aspect ratio"
            }
            aria-label="Match reference aspect ratio"
          >
            <AspectRatioPreview
              width={hasDimensions ? dimensions.width : 1}
              height={hasDimensions ? dimensions.height : 1}
              maxDim={12}
              variant="icon"
            />
          </button>
        )}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(img.id);
          }}
          disabled={!referenceEnabled}
          className="text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary border-c-border/70 flex h-full w-5 items-center justify-center border-r disabled:cursor-not-allowed disabled:opacity-40"
          title="Edit reference"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(img.id);
          }}
          disabled={!referenceEnabled}
          className="text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary flex h-full w-5 items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
          title="Remove reference"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
