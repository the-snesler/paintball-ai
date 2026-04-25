import { Maximize } from "lucide-react";
import { RESOLUTIONS_LABELS, anyModelSupportsResolution } from "~/lib/models";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";
import type { Resolution } from "~/types";

export function ResolutionSection() {
  const resolution = useGenerationStore((s) => s.currentResolution);
  const setResolution = useGenerationStore((s) => s.setResolution);
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);

  // Derive selected model IDs from modelSelections (subscribing to the actual state)
  const selectedModels = Object.entries(modelSelections)
    .filter(([, count]) => count > 0)
    .map(([modelId]) => modelId);
  const pickerEnabled = anyModelSupportsResolution(models, selectedModels);

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-text-muted">
          <Maximize className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-medium tracking-wide text-text-tertiary uppercase">Resolution</h2>
      </div>
      <div className="flex gap-2">
        {RESOLUTIONS_LABELS.map(([label, res]) => {
          const isSelected = resolution === res;
          const showSelectedStyle = isSelected && pickerEnabled;

          return (
            <button
              key={res}
              onClick={() => pickerEnabled && setResolution(res as Resolution)}
              disabled={!pickerEnabled}
              className={`flex-1 rounded-lg px-1 py-2 text-sm font-medium transition-colors ${
                showSelectedStyle
                  ? "border border-purple-500 bg-purple-500/20 text-purple-300"
                  : pickerEnabled
                    ? "border border-c-border bg-surface-overlay text-text-tertiary hover:border-c-border"
                    : "cursor-not-allowed border border-border-subtle bg-surface-overlay/50 text-text-muted opacity-40"
              }`}
            >
              {label}
              <p className="text-[0.6rem] text-text-muted">{res} resolution</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
