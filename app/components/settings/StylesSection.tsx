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
import { Palette } from "lucide-react";
import { useCallback } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import AddCustomStyleButton from "./AddCustomStyleButton";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import SortableStyleItem from "./SortableStyleItem";

export function StylesSection() {
  const styles = useSettingsStore((s) => s.styles);
  const reorderStyles = useSettingsStore((s) => s.reorderStyles);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (over && active.id !== over.id) reorderStyles(String(active.id), String(over.id));
    },
    [reorderStyles]
  );

  return (
    <section id="styles" className="group space-y-3">
      <SettingsSectionHeader
        icon={Palette}
        title="Styles"
        subtitle="Manage your style presets. Styles can be applied to prompts to influence the aesthetic of the generated image. If a text model is available, it will integrate the style into the prompt as natural prose. Otherwise, the style text will be appended to the prompt."
      />

      <div className="space-y-1 pl-6">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={styles.map((style) => style.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {styles.map((style) => (
                <SortableStyleItem key={style.id} style={style} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <AddCustomStyleButton />
      </div>
    </section>
  );
}
