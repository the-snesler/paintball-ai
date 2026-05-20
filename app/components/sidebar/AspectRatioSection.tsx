import { ChevronRight, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ASPECT_RATIOS,
  getAspectRatioIntersection,
  getAspectRatioUnion,
  isSoleArbitraryAspectRatioModel,
  parseAspectRatio,
} from "~/lib/models";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { Accordion } from "@base-ui/react/accordion";

const ARBITRARY_MODE_PRESETS = ["3:2", "2:3"];

export function AspectRatioSection() {
  const aspectRatio = useGenerationStore((s) => s.currentAspectRatio);
  const setAspectRatio = useGenerationStore((s) => s.setAspectRatio);
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);

  // Derive selected model IDs from modelSelections (subscribing to the actual state)
  const selectedModels = Object.entries(modelSelections)
    .filter(([, count]) => count > 0)
    .map(([modelId]) => modelId);

  const arbitraryMode = isSoleArbitraryAspectRatioModel(models, selectedModels);
  const arbitraryMaxLongShort = arbitraryMode
    ? (models.find((m) => m.id === selectedModels[0])?.capabilities.maxLongShortRatio ?? Infinity)
    : Infinity;

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
  const hasAdditionalRatios = arbitraryMode || selectableRatios.length > splitAt;

  const renderRatio = (ratio: string, opts?: { forceEnabled?: boolean }) => {
    const builtInMeta = ASPECT_RATIOS.find((ar) => ar.value === ratio);
    const parsed = parseAspectRatio(ratio);
    const isSelected = aspectRatio === ratio;
    const isEnabled = opts?.forceEnabled || selectableSet.has(ratio);

    return (
      <button
        key={ratio}
        onClick={() => isEnabled && setAspectRatio(isSelected ? null : ratio)}
        disabled={!isEnabled}
        className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition-colors ${
          isSelected
            ? "border border-purple-500 bg-purple-500/20"
            : isEnabled
              ? "border-c-border bg-surface-overlay hover:border-c-border border"
              : "border-border-subtle bg-surface-overlay/50 cursor-not-allowed border opacity-40"
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
        <span className="text-text-tertiary text-[10px]">{ratio}</span>
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
            <h2 className="text-text-tertiary text-xs font-medium tracking-wide uppercase">
              Aspect Ratio
            </h2>
            {hasAdditionalRatios && (
              <Accordion.Header className="ml-auto">
                <Accordion.Trigger className="group text-text-muted hover:text-text-secondary flex cursor-pointer items-center gap-1 rounded text-xs transition-colors">
                  <span className="group-data-panel-open:hidden">Show more</span>
                  <span className="hidden group-data-panel-open:inline">Show less</span>
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-panel-open:rotate-90" />
                </Accordion.Trigger>
              </Accordion.Header>
            )}
          </div>

          <div className="grid grid-cols-6 gap-1.5">{primaryRatios.map((r) => renderRatio(r))}</div>

          {arbitraryMode ? (
            <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0">
              <div className="mt-1.5 grid grid-cols-6 gap-1.5">
                {ARBITRARY_MODE_PRESETS.map((r) => renderRatio(r, { forceEnabled: true }))}
                <CustomAspectRatioInput
                  currentAspectRatio={aspectRatio}
                  setAspectRatio={setAspectRatio}
                  maxLongShortRatio={arbitraryMaxLongShort}
                />
              </div>
            </Accordion.Panel>
          ) : (
            hiddenRatios.length > 0 && (
              <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0">
                <div className="mt-1.5 grid grid-cols-6 gap-1.5">
                  {hiddenRatios.map((r) => renderRatio(r))}
                </div>
              </Accordion.Panel>
            )
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

function parseCustomSeed(aspectRatio: string | null): { w: string; h: string } {
  if (!aspectRatio) return { w: "3", h: "2" };
  const [wStr, hStr] = aspectRatio.split(":");
  const w = Number(wStr);
  const h = Number(hStr);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { w: "3", h: "2" };
  }
  return { w: String(w), h: String(h) };
}

function CustomAspectRatioInput({
  currentAspectRatio,
  setAspectRatio,
  maxLongShortRatio,
}: {
  currentAspectRatio: string | null;
  setAspectRatio: (ratio: string | null) => void;
  maxLongShortRatio: number;
}) {
  const seed = parseCustomSeed(currentAspectRatio);
  const [wInput, setWInput] = useState(seed.w);
  const [hInput, setHInput] = useState(seed.h);

  // Keep inputs in sync when an external preset is clicked (e.g. 3:2 / 2:3).
  useEffect(() => {
    const next = parseCustomSeed(currentAspectRatio);
    setWInput(next.w);
    setHInput(next.h);
  }, [currentAspectRatio]);

  const wNum = Number(wInput);
  const hNum = Number(hInput);
  const numericValid =
    Number.isFinite(wNum) && Number.isFinite(hNum) && wNum > 0 && hNum > 0;
  const ratioValid =
    numericValid && Math.max(wNum, hNum) / Math.min(wNum, hNum) <= maxLongShortRatio;

  const candidate = numericValid ? `${wNum}:${hNum}` : null;
  const isSelected = !!candidate && currentAspectRatio === candidate;

  const apply = (nextW: string, nextH: string) => {
    const w = Number(nextW);
    const h = Number(nextH);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
    if (Math.max(w, h) / Math.min(w, h) > maxLongShortRatio) return;
    setAspectRatio(`${w}:${h}`);
  };

  const capLabel = Number.isFinite(maxLongShortRatio) ? `${maxLongShortRatio}:1` : "limit";

  const previewW = numericValid ? wNum : 1;
  const previewH = numericValid ? hNum : 1;

  return (
    <div
      className={`col-span-4 flex items-center gap-2 rounded-lg p-1.5 transition-colors ${
        isSelected
          ? "border border-purple-500 bg-purple-500/20"
          : "border-c-border bg-surface-overlay border"
      }`}
    >
      <AspectRatioPreview width={previewW} height={previewH} isSelected={isSelected} />
      <div className="flex flex-1 items-center gap-1">
        <input
          type="number"
          min={1}
          step={1}
          value={wInput}
          onChange={(e) => {
            setWInput(e.target.value);
            apply(e.target.value, hInput);
          }}
          aria-label="Custom aspect ratio width"
          className="bg-surface-interactive text-text-primary focus:ring-purple-500 w-0 min-w-0 flex-1 rounded px-1.5 py-1 text-center text-xs tabular-nums focus:ring-1 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-text-tertiary text-xs">:</span>
        <input
          type="number"
          min={1}
          step={1}
          value={hInput}
          onChange={(e) => {
            setHInput(e.target.value);
            apply(wInput, e.target.value);
          }}
          aria-label="Custom aspect ratio height"
          className="bg-surface-interactive text-text-primary focus:ring-purple-500 w-0 min-w-0 flex-1 rounded px-1.5 py-1 text-center text-xs tabular-nums focus:ring-1 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      {!ratioValid && numericValid && (
        <span
          className="text-[10px] text-red-400"
          title={`Long edge must be ≤ ${maxLongShortRatio}× short edge`}
        >
          max {capLabel}
        </span>
      )}
    </div>
  );
}
