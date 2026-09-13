import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Users } from "lucide-react";
import { useCallback } from "react";
import { Link } from "react-router";
import { useSettingsStore } from "~/stores/settingsStore";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import SortableCharacterItem from "./SortableCharacterItem";

export function CharactersSection() {
  const characters = useSettingsStore((s) => s.characters);
  const reorderCharacters = useSettingsStore((s) => s.reorderCharacters);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (over && active.id !== over.id) reorderCharacters(String(active.id), String(over.id));
    },
    [reorderCharacters]
  );

  return (
    <section id="characters" className="group">
      <SettingsSectionHeader
        icon={Users}
        title="Characters"
        subtitle="Manage your character roster. You can add as many as you want to one prompt."
      />

      <div className="space-y-1 pl-6">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={characters.map((character) => character.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {characters.map((character) => (
                <SortableCharacterItem key={character.id} character={character} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Link
          to="/app/characters/new"
          className="border-c-border text-text-tertiary hover:border-c-border hover:text-text-secondary flex w-full items-center gap-2 rounded-lg border border-dashed p-2.5 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">Add character</span>
        </Link>
      </div>
    </section>
  );
}
