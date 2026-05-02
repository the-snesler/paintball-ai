import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import StyleItem from "./StyleItem";
import type { StoredStyle } from "~/types";

export default function SortableStyleItem({ style }: { style: StoredStyle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: style.id,
  });

  const wrapperStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={wrapperStyle}
      className={isDragging ? "relative z-50 opacity-75" : ""}
    >
      <StyleItem style={style} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}
