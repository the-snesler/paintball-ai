import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CharacterItem from "./CharacterItem";
import type { StoredCharacter } from "~/types";

export default function SortableCharacterItem({ character }: { character: StoredCharacter }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: character.id,
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
      <CharacterItem character={character} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}
