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
import { Expand } from "lucide-react";
import { useCallback } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import { Switch } from "~/components/ui/Switch";
import AddCustomUpscalerButton from "./AddCustomUpscalerButton";
import { SettingsSectionHeader } from "./SettingsSectionHeader";
import SortableUpscalerItem from "./SortableUpscalerItem";

export function EditorSection() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const upscalers = useSettingsStore((s) => s.upscalers);
  const editorContextInjectionEnabled = useSettingsStore((s) => s.editorContextInjectionEnabled);
  const reorderUpscalers = useSettingsStore((s) => s.reorderUpscalers);
  const setEditorContextInjectionEnabled = useSettingsStore(
    (s) => s.setEditorContextInjectionEnabled
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (over && active.id !== over.id) reorderUpscalers(String(active.id), String(over.id));
    },
    [reorderUpscalers]
  );

  return (
    <section id="editor" className="group space-y-3">
      <SettingsSectionHeader
        icon={Expand}
        title="Editor"
        subtitle="Manage your editor settings. Upscaling models are only available in the editor."
      />

      <div className="space-y-3 pl-6">
        <div className="space-y-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={upscalers.map((upscaler) => upscaler.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {upscalers.map((upscaler) => (
                  <SortableUpscalerItem
                    key={upscaler.id}
                    upscaler={upscaler}
                    hasApiKey={Boolean(apiKeys.replicate)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <AddCustomUpscalerButton />
        </div>

        <div className="border-border-subtle bg-surface-raised/60 space-y-3 rounded-lg border p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-text-secondary text-sm">Editor context briefs</span>
            <Switch
              checked={editorContextInjectionEnabled}
              onChange={(event) => setEditorContextInjectionEnabled(event.target.checked)}
              aria-label="Toggle editor context injection"
            />
          </label>
          <p className="text-text-muted text-xs">
            After each edit, an AI summary of your editing intent is generated and prepended to
            subsequent prompts. This helps maintain style and character consistency across multiple
            edits.
          </p>
        </div>
      </div>
    </section>
  );
}
