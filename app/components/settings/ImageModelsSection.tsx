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
import { Layers } from "lucide-react";
import { useCallback } from "react";
import { hasProviderAccess } from "~/lib/providers";
import { useSettingsStore } from "~/stores/settingsStore";
import AddCustomModelButton from "./AddCustomModelButton";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import SortableModelItem from "./SortableModelItem";

export function ImageModelsSection() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const models = useSettingsStore((s) => s.models);
  const reorderModels = useSettingsStore((s) => s.reorderModels);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (over && active.id !== over.id) reorderModels(String(active.id), String(over.id));
    },
    [reorderModels]
  );

  return (
    <section id="image-models" className="group">
      <SettingsSectionHeader
        icon={Layers}
        title="Image models"
        subtitle="Manage your image generation models. The order of this list determines the order of models in the model selector."
      />

      <div className="space-y-1 pl-6">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={models.map((model) => model.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {models.map((model) => (
                <SortableModelItem
                  key={model.id}
                  model={model}
                  hasApiKey={hasProviderAccess(apiKeys, model.provider)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <AddCustomModelButton />
      </div>
    </section>
  );
}
