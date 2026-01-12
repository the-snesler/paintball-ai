import { Maximize } from "lucide-react";
import { RESOLUTIONS, anyModelSupportsResolution } from "~/lib/models";
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
  const showResolution = anyModelSupportsResolution(models, selectedModels);

  // Don't render if no selected model supports resolution
  if (!showResolution) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Maximize className="w-4 h-4 text-zinc-500" />
        <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Resolution
        </h2>
      </div>
      <div className="flex gap-2">
        {RESOLUTIONS.map((res) => {
          const isSelected = resolution === res;

          return (
            <button
              key={res}
              onClick={() => setResolution(res as Resolution)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                isSelected
                  ? "bg-purple-500/20 border border-purple-500 text-purple-300"
                  : "bg-zinc-800 border border-zinc-700 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              {res}
            </button>
          );
        })}
      </div>
    </section>
  );
}
