import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { QUALITIES, anyModelSupportsQuality, getQualityIntersection } from "~/lib/models";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";

const QUALITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  auto: "Auto",
};

export function QualitySection() {
  const quality = useGenerationStore((s) => s.currentQuality);
  const setQuality = useGenerationStore((s) => s.setQuality);
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);

  const selectedModels = Object.entries(modelSelections)
    .filter(([, count]) => count > 0)
    .map(([modelId]) => modelId);

  const pickerEnabled = anyModelSupportsQuality(models, selectedModels);
  const selectable = useMemo(
    () => new Set(getQualityIntersection(models, selectedModels)),
    [models, selectedModels]
  );

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-zinc-500">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Quality</h2>
      </div>
      <div className="flex gap-2">
        {QUALITIES.map((q) => {
          const isSelected = quality === q;
          const isEnabled = pickerEnabled && (selectable.size === 0 || selectable.has(q));
          const showSelectedStyle = isSelected && isEnabled;

          return (
            <button
              key={q}
              onClick={() => isEnabled && setQuality(isSelected ? null : q)}
              disabled={!isEnabled}
              className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                showSelectedStyle
                  ? "border border-purple-500 bg-purple-500/20 text-purple-300"
                  : isEnabled
                    ? "border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
                    : "cursor-not-allowed border border-zinc-800 bg-zinc-800/50 text-zinc-500 opacity-40"
              }`}
            >
              {QUALITY_LABELS[q] ?? q}
            </button>
          );
        })}
      </div>
    </section>
  );
}
