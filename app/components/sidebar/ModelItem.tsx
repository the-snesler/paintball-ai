import { Box, Minus, Plus } from "lucide-react";
import SVG from "react-inlinesvg";
import NumberFlow from "@number-flow/react";
import type { StoredModel } from "~/types";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { anyModelSupportsReferenceImages } from "~/lib/models";

interface ModelItemProps {
  model: StoredModel;
  count: number;
}

const providerNames: Record<string, string> = {
  google: "Google",
  replicate: "Replicate",
};

export function ModelItem({ model, count }: ModelItemProps) {
  const setModelCount = useGenerationStore((s) => s.setModelCount);

  const isActive = count > 0;

  const clearReferencesIfUnsupported = (nextCount: number) => {
    const selections = useGenerationStore.getState().currentModelSelections;
    const nextSelections = { ...selections, [model.id]: nextCount };
    const selectedIds = Object.entries(nextSelections)
      .filter(([, c]) => c > 0)
      .map(([id]) => id);
    const models = useSettingsStore.getState().models;

    if (!anyModelSupportsReferenceImages(models, selectedIds)) {
      useGenerationStore.getState().clearReferenceImages();
    }
  };

  const handleDecrement = () => {
    if (count > 0) {
      setModelCount(model.id, count - 1);
      clearReferencesIfUnsupported(count - 1);
    }
  };

  const handleIncrement = () => {
    setModelCount(model.id, count + 1);
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${
        isActive
          ? "border border-purple-500/30 bg-purple-500/10"
          : "border border-transparent bg-zinc-800/50 hover:bg-zinc-800"
      }`}
    >
      {/* Icon */}
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          isActive ? "bg-purple-500/20 text-purple-400" : "bg-zinc-700 text-zinc-400"
        }`}
      >
        {model.icon ? <SVG src={model.icon} className="h-5 w-5" /> : <Box className="h-4 w-4" />}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100" title={model.name}>
          {model.name}
        </p>
        <p className="text-xs text-zinc-500">{providerNames[model.provider]}</p>
      </div>

      {/* Counter */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleDecrement}
          disabled={count === 0}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Decrease count"
        >
          <Minus className="h-3 w-3" />
        </button>
        <div className="w-6 text-center text-sm font-medium text-zinc-300">
          <NumberFlow
            value={count}
            format={{ useGrouping: false }}
            transformTiming={{ duration: 300, easing: "ease-out" }}
            spinTiming={{ duration: 300, easing: "ease-out" }}
            opacityTiming={{ duration: 150, easing: "ease-out" }}
            willChange
          />
        </div>
        <button
          onClick={handleIncrement}
          className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
          aria-label="Increase count"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
