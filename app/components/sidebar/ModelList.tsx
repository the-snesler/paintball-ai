import { Layers } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { ModelItem } from "./ModelItem";
import { CollapsibleSection } from "./CollapsibleSection";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";

export function ModelList() {
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);
  const apiKeys = useSettingsStore((s) => s.apiKeys);

  // Filter to only show enabled models that have API keys
  const visibleModels = models.filter((m) => m.enabled && apiKeys[m.provider]);

  const activeCount = Object.values(modelSelections).filter((c) => c > 0).length;

  return (
    <CollapsibleSection
      icon={<Layers className="h-4 w-4" />}
      title="Models"
      badge={
        <span className="rounded-full bg-zinc-800 px-2 text-xs text-zinc-400">
          <NumberFlow
            value={activeCount}
            format={{ useGrouping: false }}
            transformTiming={{ duration: 300, easing: "ease-out" }}
            spinTiming={{ duration: 300, easing: "ease-out" }}
            opacityTiming={{ duration: 150, easing: "ease-out" }}
            willChange
          />{" "}
          active
        </span>
      }
    >
      <div className="space-y-1">
        {visibleModels.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">
            No models available. Add API keys and enable models in Settings.
          </p>
        ) : (
          visibleModels.map((model) => (
            <ModelItem key={model.id} model={model} count={modelSelections[model.id] || 0} />
          ))
        )}
      </div>
    </CollapsibleSection>
  );
}
