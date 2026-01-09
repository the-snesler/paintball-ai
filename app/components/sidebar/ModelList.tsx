import { Layers } from "lucide-react";
import { ModelItem } from "./ModelItem";
import { MODELS } from "~/lib/models";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";

export function ModelList() {
  const modelSelections = useGalleryStore((s) => s.currentModelSelections);
  const apiKeys = useSettingsStore((s) => s.apiKeys);

  const activeCount = Object.values(modelSelections).filter((c) => c > 0).length;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-500" />
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Models
          </h2>
        </div>
        {activeCount > 0 && (
          <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-400">
            {activeCount} active
          </span>
        )}
      </div>
      <div className="space-y-1">
        {MODELS.map((model) => (
          <ModelItem
            key={model.id}
            model={model}
            count={modelSelections[model.id] || 0}
            hasApiKey={!!apiKeys[model.apiKeyRequired]}
          />
        ))}
      </div>
    </section>
  );
}
