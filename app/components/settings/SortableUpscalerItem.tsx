import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import UpscalerItem from "./UpscalerItem";
import type { StoredUpscaler } from "~/types";

export default function SortableUpscalerItem({
  upscaler,
  hasApiKey,
}: {
  upscaler: StoredUpscaler;
  hasApiKey: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: upscaler.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "relative z-50 opacity-75" : ""}>
      <UpscalerItem
        upscaler={upscaler}
        hasApiKey={hasApiKey}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
