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
        <span className="text-zinc-500">
          <Maximize className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Resolution</h2>
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
                    ? "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                    : "cursor-not-allowed border border-zinc-800 bg-zinc-800/50 text-zinc-500 opacity-40"
              }`}
            >
              {label}
              <p className="text-[0.6rem] text-zinc-600">{res} resolution</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
