import { Layers } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { ModelItem } from "./ModelItem";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";

export function ModelList() {
  const modelSelections = useGalleryStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);
  const apiKeys = useSettingsStore((s) => s.apiKeys);

  // Filter to only show enabled models that have API keys
  const visibleModels = models.filter(
    (m) => m.enabled && apiKeys[m.provider]
  );

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
        <span className="text-xs px-2 bg-zinc-800 rounded-full text-zinc-400">
          <NumberFlow
            value={activeCount}
            format={{ useGrouping: false }}
            transformTiming={{ duration: 300, easing: 'ease-out' }}
            spinTiming={{ duration: 300, easing: 'ease-out' }}
            opacityTiming={{ duration: 150, easing: 'ease-out' }}
            willChange
          /> active
        </span>
      </div>
      <div className="space-y-1">
        {visibleModels.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-4">
            No models available. Add API keys and enable models in Settings.
          </p>
        ) : (
          visibleModels.map((model) => (
            <ModelItem
              key={model.id}
              model={model}
              count={modelSelections[model.id] || 0}
            />
          ))
        )}
      </div>
    </section>
  );
}
