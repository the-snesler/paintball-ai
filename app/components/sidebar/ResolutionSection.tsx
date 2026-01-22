import { Maximize } from "lucide-react";
import { RESOLUTIONS, anyModelSupportsResolution } from "~/lib/models";
import { CollapsibleSection } from "./CollapsibleSection";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import type { Resolution } from "~/types";

export function ResolutionSection() {
  const resolution = useGalleryStore((s) => s.currentResolution);
  const setResolution = useGalleryStore((s) => s.setResolution);
  const modelSelections = useGalleryStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);

  // Derive selected model IDs from modelSelections (subscribing to the actual state)
  const selectedModels = Object.entries(modelSelections)
    .filter(([, count]) => count > 0)
    .map(([modelId]) => modelId);
  const pickerEnabled = anyModelSupportsResolution(models, selectedModels);

  return (
    <CollapsibleSection
      icon={<Maximize className="w-4 h-4" />}
      title="Resolution"
    >
      <div className="flex gap-2">
        {RESOLUTIONS.map((res) => {
          const isSelected = resolution === res;
          const showSelectedStyle = isSelected && pickerEnabled;

          return (
            <button
              key={res}
              onClick={() => pickerEnabled && setResolution(res as Resolution)}
              disabled={!pickerEnabled}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                showSelectedStyle
                  ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                  : pickerEnabled
                  ? "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  : "bg-zinc-800/50 border border-zinc-800 opacity-40 cursor-not-allowed text-zinc-500"
              }`}
            >
              {res}
            </button>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
