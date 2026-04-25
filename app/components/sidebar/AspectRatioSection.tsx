import { ChevronRight, Square } from "lucide-react";
import { useMemo } from "react";
import {
  ASPECT_RATIOS,
  getAspectRatioIntersection,
  getAspectRatioUnion,
  parseAspectRatio,
} from "~/lib/models";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { Accordion } from "@base-ui/react/accordion";

export function AspectRatioSection() {
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
  const extraRatios = visibleRatios
    .filter((ratio) => !primaryRatioValues.includes(ratio))
    .sort((a, b) => {
      const aParsed = parseAspectRatio(a);
      const bParsed = parseAspectRatio(b);
      const aValue = aParsed.width / aParsed.height;
      const bValue = bParsed.width / bParsed.height;
      return aValue - bValue;
    });
  const allRatios = [...primaryRatioValues, ...extraRatios].sort((a, b) => {
    const aIsEnabled = selectableSet.has(a);
    const bIsEnabled = selectableSet.has(b);
    if (aIsEnabled && !bIsEnabled) return -1;
    if (!aIsEnabled && bIsEnabled) return 1;
    return 0;
  });

  const splitAt = primaryRatioValues.length;
  const primaryRatios = allRatios.slice(0, splitAt);
  const hiddenRatios = allRatios.slice(splitAt);
  const hasAdditionalRatios = selectableRatios.length > splitAt;

  const renderRatio = (ratio: string) => {
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
              ? "border border-c-border bg-surface-overlay hover:border-c-border"
              : "cursor-not-allowed border border-border-subtle bg-surface-overlay/50 opacity-40"
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
        <span className="text-[10px] text-text-tertiary">{ratio}</span>
      </button>
    );
  };

  return (
    <section>
      <Accordion.Root>
        <Accordion.Item>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-text-muted">
              <Square className="h-4 w-4" />
            </span>
            <h2 className="text-xs font-medium tracking-wide text-text-tertiary uppercase">
              Aspect Ratio
            </h2>
            {hasAdditionalRatios && (
              <Accordion.Header className="ml-auto">
                <Accordion.Trigger className="group flex cursor-pointer items-center gap-1 rounded text-xs text-text-muted transition-colors hover:text-text-secondary">
                  <span className="group-data-panel-open:hidden">Show more</span>
                  <span className="hidden group-data-panel-open:inline">Show less</span>
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-panel-open:rotate-90" />
                </Accordion.Trigger>
              </Accordion.Header>
            )}
          </div>

          <div className="grid grid-cols-6 gap-1.5">{primaryRatios.map(renderRatio)}</div>

          {hiddenRatios.length > 0 && (
            <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0">
              <div className="mt-1.5 grid grid-cols-6 gap-1.5">
                {hiddenRatios.map(renderRatio)}
              </div>
            </Accordion.Panel>
          )}
        </Accordion.Item>
      </Accordion.Root>
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
        isSelected ? "border-purple-500 bg-purple-500/20" : "border-c-border"
      }`}
      style={{ width: `${w}px`, height: `${h}px` }}
    />
  );
}
