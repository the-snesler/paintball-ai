import { Images } from "lucide-react";
import { useEffect } from "react";
import { anyModelSupportsNumberOfImages, getMaxImagesPerRequest } from "~/lib/models";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";

export function NumberOfImagesSection() {
  const numberOfImages = useGenerationStore((s) => s.currentNumberOfImages);
  const setNumberOfImages = useGenerationStore((s) => s.setNumberOfImages);
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const models = useSettingsStore((s) => s.models);

  const selectedModels = Object.entries(modelSelections)
    .filter(([, count]) => count > 0)
    .map(([modelId]) => modelId);

  const enabled = anyModelSupportsNumberOfImages(models, selectedModels);
  const max = enabled ? getMaxImagesPerRequest(models, selectedModels) : 1;

  // Clamp to the current max when the selection changes.
  useEffect(() => {
    if (numberOfImages > max) setNumberOfImages(max);
  }, [max, numberOfImages, setNumberOfImages]);

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-zinc-500">
          <Images className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Images / call</h2>
        <span className="ml-auto text-xs font-medium tabular-nums text-zinc-300">
          {numberOfImages}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={Math.max(1, max)}
        step={1}
        value={Math.min(numberOfImages, Math.max(1, max))}
        onChange={(e) => setNumberOfImages(Number(e.target.value))}
        disabled={!enabled || max <= 1}
        className={`h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-purple-500 ${
          !enabled || max <= 1 ? "cursor-not-allowed opacity-40" : ""
        }`}
      />
      <div className="mt-1 flex justify-between text-[10px] text-zinc-500 tabular-nums">
        <span>1</span>
        <span>{Math.max(1, max)}</span>
      </div>
    </section>
  );
}
