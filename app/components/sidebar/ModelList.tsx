import { Layers } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { ModelItem } from "./ModelItem";
import { CollapsibleSection } from "./CollapsibleSection";
import { hasProviderAccess } from "~/lib/providers";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";

export function ModelList() {
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);
  const apiKeys = useSettingsStore((s) => s.apiKeys);

  // Filter to only show enabled models the current environment can use.
  const visibleModels = models.filter((m) => m.enabled && hasProviderAccess(apiKeys, m.provider));

  const activeCount = Object.values(modelSelections).filter((c) => c > 0).length;

  return (
    <CollapsibleSection
      value="models"
      icon={<Layers className="h-4 w-4" />}
      title="Models"
      tooltip="Models available for generation. Add more models and providers in Settings."
      badge={
        <span className="bg-surface-overlay text-text-tertiary rounded-full px-2 text-xs">
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
          <p className="text-text-muted py-4 text-center text-xs">
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
