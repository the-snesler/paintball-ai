import { RotateCcw, Sparkles } from "lucide-react";
import { QUALITIES, getQualityIntersection } from "~/lib/models";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";

const QUALITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
};

export function QualitySection() {
  const quality = useGenerationStore((s) => s.currentQuality);
  const setQuality = useGenerationStore((s) => s.setQuality);
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);

  const selectedModels = Object.entries(modelSelections)
    .filter(([, count]) => count > 0)
    .map(([modelId]) => modelId);

  const supported = new Set(getQualityIntersection(models, selectedModels));
  const qualities = QUALITIES.filter((value) => supported.has(value));
  const selectedQualityIndex = quality
    ? qualities.indexOf(quality as (typeof qualities)[number])
    : -1;
  const selectedIndex = selectedQualityIndex + 1;
  const selectedProgress = selectedIndex / qualities.length;
  const selectedPosition = `calc(${selectedProgress * 100}% + ${1 - selectedProgress * 2}rem)`;

  if (qualities.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-text-muted">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 className="text-text-tertiary text-xs font-medium tracking-wide uppercase">Quality</h2>
        <span className="text-text-secondary ml-auto text-xs font-medium">
          {selectedIndex === 0 ? "Default" : QUALITY_LABELS[qualities[selectedQualityIndex]]}
        </span>
      </div>
      <div className="relative h-10">
        <input
          type="range"
          min={0}
          max={qualities.length}
          step={1}
          value={selectedIndex}
          aria-label="Quality"
          aria-valuetext={
            selectedIndex === 0 ? "Default" : QUALITY_LABELS[qualities[selectedQualityIndex]]
          }
          onChange={(event) => {
            const index = Number(event.target.value);
            setQuality(index === 0 ? null : qualities[index - 1]);
          }}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
        <div className="bg-surface-overlay peer-focus-visible:ring-accent absolute inset-x-0 inset-y-1 overflow-hidden rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-(--surface)">
          <div
            className="h-full bg-purple-500 transition-[width] duration-150"
            style={{ width: selectedPosition }}
          />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between">
          {[null, ...qualities].map((value) => {
            const isDefault = value === null;

            return (
              <span
                key={value ?? "default"}
                className="flex h-10 w-8 items-center justify-center rounded-full"
              >
                {isDefault ? (
                  <RotateCcw className="text-text-primary/25 h-3.5 w-3.5" />
                ) : (
                  <span className="bg-text-primary/25 h-1.5 w-1.5 rounded-full" />
                )}
              </span>
            );
          })}
        </div>
        <span
          className="bg-surface-raised border-c-border pointer-events-none absolute top-1/2 z-1 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-md transition-[left] duration-150"
          style={{ left: selectedPosition }}
        >
          {selectedIndex === 0 && <RotateCcw className="text-text-tertiary h-3.5 w-3.5" />}
        </span>
      </div>
    </section>
  );
}
