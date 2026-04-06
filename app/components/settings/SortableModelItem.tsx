import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ModelToggleItem from "./ModelToggle";
import type { StoredModel } from "~/types";

export default function SortableModelItem({
  model,
  hasApiKey,
}: {
  model: StoredModel;
  hasApiKey: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: model.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "relative z-50 opacity-75" : ""}>
      <ModelToggleItem model={model} hasApiKey={hasApiKey} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}
