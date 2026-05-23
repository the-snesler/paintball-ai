import { Pencil, X } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";

interface SortableReferenceImageProps {
  img: { id: string; url: string; name: string };
  onRemove: (id: string) => void;
  onOpen: (img: { id: string; url: string; name: string }) => void;
  onEdit: (id: string) => void;
  referenceEnabled?: boolean;
}

export function SortableReferenceImage({
  img,
  onRemove,
  onOpen,
  onEdit,
  referenceEnabled = true,
}: SortableReferenceImageProps) {
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
        <img src={img.url} alt={img.name} className="h-full w-full rounded object-cover" />
      </button>
      <div className="border-c-border bg-surface-raised absolute -top-1 -right-1 flex h-5 overflow-hidden rounded-full border opacity-0 transition-opacity group-hover:opacity-100">
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
