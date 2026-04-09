import { Square } from "lucide-react";
import { ASPECT_RATIOS, anyModelSupportsAspectRatio } from "~/lib/models";
import { CollapsibleSection } from "./CollapsibleSection";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";

export function AspectRatioSection() {
  const aspectRatio = useGenerationStore((s) => s.currentAspectRatio);
  const setAspectRatio = useGenerationStore((s) => s.setAspectRatio);
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);

  // Derive selected model IDs from modelSelections (subscribing to the actual state)
  const selectedModels = Object.entries(modelSelections)
    .filter(([, count]) => count > 0)
    .map(([modelId]) => modelId);
  const pickerEnabled = anyModelSupportsAspectRatio(models, selectedModels);

  return (
    <CollapsibleSection icon={<Square className="h-4 w-4" />} title="Aspect Ratio">
      <div className="grid grid-cols-6 gap-1.5">
        {ASPECT_RATIOS.map((ar) => {
          const isSelected = aspectRatio === ar.value;
          const showSelectedStyle = isSelected && pickerEnabled;

          return (
            <button
              key={ar.value}
              onClick={() => pickerEnabled && setAspectRatio(isSelected ? null : ar.value)}
              disabled={!pickerEnabled}
              className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition-colors ${
                showSelectedStyle
                  ? "border border-purple-500 bg-purple-500/20"
                  : pickerEnabled
                    ? "border border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                    : "cursor-not-allowed border border-zinc-800 bg-zinc-800/50 opacity-40"
              }`}
              title={ar.label}
            >
              <div className="flex-1" />
              <AspectRatioPreview
                width={ar.width}
                height={ar.height}
                isSelected={showSelectedStyle}
              />
              <div className="flex-1" />
              <span className="text-[10px] text-zinc-400">{ar.label}</span>
            </button>
          );
        })}
      </div>
    </CollapsibleSection>
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
