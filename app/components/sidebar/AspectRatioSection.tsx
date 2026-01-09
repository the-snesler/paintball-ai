import { Square } from "lucide-react";
import { ASPECT_RATIOS, getCommonAspectRatios, anyModelSupportsAspectRatio } from "~/lib/models";
import { useGenerationStore } from "~/stores/generationStore";

export function AspectRatioSection() {
  const aspectRatio = useGenerationStore((s) => s.aspectRatio);
  const setAspectRatio = useGenerationStore((s) => s.setAspectRatio);
  const modelSelections = useGenerationStore((s) => s.modelSelections);

  // Derive selected model IDs from modelSelections (subscribing to the actual state)
  const selectedModels = Object.entries(modelSelections)
    .filter(([, count]) => count > 0)
    .map(([modelId]) => modelId);
  const pickerEnabled = selectedModels.length === 0 || anyModelSupportsAspectRatio(selectedModels);
  const supportedRatios = getCommonAspectRatios(selectedModels);

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Square className="w-4 h-4 text-zinc-500" />
        <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Aspect Ratio
        </h2>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {ASPECT_RATIOS.map((ar) => {
          const isSupported = pickerEnabled && supportedRatios.includes(ar.value);
          const isSelected = aspectRatio === ar.value;
          const showSelectedStyle = isSelected && pickerEnabled;

          return (
            <button
              key={ar.value}
              onClick={() => isSupported && setAspectRatio(ar.value)}
              disabled={!isSupported}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-colors ${
                showSelectedStyle
                  ? "bg-purple-500/20 border border-purple-500"
                  : isSupported
                  ? "bg-zinc-800 border border-zinc-700 hover:border-zinc-600"
                  : "bg-zinc-800/50 border border-zinc-800 opacity-40 cursor-not-allowed"
              }`}
              title={ar.label}
            >
              <AspectRatioPreview
                width={ar.width}
                height={ar.height}
                isSelected={showSelectedStyle}
              />
              <span className="text-[10px] text-zinc-400">{ar.label}</span>
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
      className={`border rounded-sm ${
        isSelected ? "border-purple-500 bg-purple-500/20" : "border-zinc-600"
      }`}
      style={{ width: `${w}px`, height: `${h}px` }}
    />
  );
}
