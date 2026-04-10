import { ChevronDown, Square } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ASPECT_RATIOS,
  getAspectRatioIntersection,
  getAspectRatioUnion,
  parseAspectRatio,
} from "~/lib/models";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";

export function AspectRatioSection() {
  const [expanded, setExpanded] = useState(false);
  const aspectRatio = useGenerationStore((s) => s.currentAspectRatio);
  const setAspectRatio = useGenerationStore((s) => s.setAspectRatio);
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);

  // Derive selected model IDs from modelSelections (subscribing to the actual state)
  const selectedModels = Object.entries(modelSelections)
    .filter(([, count]) => count > 0)
    .map(([modelId]) => modelId);

  const selectableRatios = getAspectRatioIntersection(models, selectedModels);
  const visibleRatios = getAspectRatioUnion(models, selectedModels);
  const selectableSet = useMemo(() => new Set(selectableRatios), [selectableRatios]);

  const primaryRatioValues = ASPECT_RATIOS.map((ratio) => ratio.value);
  const additionalRatios = visibleRatios
    .filter((ratio) => !primaryRatioValues.includes(ratio))
    .sort((a, b) => {
      const aParsed = parseAspectRatio(a);
      const bParsed = parseAspectRatio(b);
      const aValue = aParsed.width / aParsed.height;
      const bValue = bParsed.width / bParsed.height;
      return aValue - bValue;
    });
  const allRatios = [...primaryRatioValues, ...additionalRatios].sort((a, b) => {
    const aIsEnabled = selectableSet.has(a);
    const bIsEnabled = selectableSet.has(b);
    if (aIsEnabled && !bIsEnabled) return -1;
    if (!aIsEnabled && bIsEnabled) return 1;
    return 0;
  });

  const ratiosToShow = expanded ? allRatios : allRatios.slice(0, primaryRatioValues.length);
  const hasAdditionalRatios = selectableRatios.length > 6;

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-zinc-500">
          <Square className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Aspect Ratio</h2>
        {hasAdditionalRatios && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="ml-auto flex items-center gap-1 rounded text-xs text-zinc-500 transition-colors hover:text-zinc-300"
            aria-expanded={expanded}
          >
            <span>{expanded ? "Show less" : "Show more"}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {ratiosToShow.map((ratio) => {
          const builtInMeta = ASPECT_RATIOS.find((ar) => ar.value === ratio);
          const parsed = parseAspectRatio(ratio);
          const isSelected = aspectRatio === ratio;
          const isEnabled = selectableSet.has(ratio);

          return (
            <button
              key={ratio}
              onClick={() => isEnabled && setAspectRatio(isSelected ? null : ratio)}
              disabled={!isEnabled}
              className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition-colors ${
                isSelected
                  ? "border border-purple-500 bg-purple-500/20"
                  : isEnabled
                    ? "border border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                    : "cursor-not-allowed border border-zinc-800 bg-zinc-800/50 opacity-40"
              }`}
              title={ratio}
            >
              <div className="flex-1" />
              <AspectRatioPreview
                width={builtInMeta?.width ?? parsed.width}
                height={builtInMeta?.height ?? parsed.height}
                isSelected={isSelected}
              />
              <div className="flex-1" />
              <span className="text-[10px] text-zinc-400">{ratio}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function AspectRatioPreview({
  width,
  height,
  isSelected,
}: {
  width: number;
  height: number;
  isSelected: boolean;
}) {
  // Normalize to max dimension of 20px
  const maxDim = 20;
  const scale = maxDim / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  return (
    <div
      className={`rounded-sm border-2 ${
        isSelected ? "border-purple-500 bg-purple-500/20" : "border-zinc-600"
      }`}
      style={{ width: `${w}px`, height: `${h}px` }}
    />
  );
}
