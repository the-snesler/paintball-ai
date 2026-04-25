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

  if (!enabled || max <= 1) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-text-muted">
          <Images className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-medium tracking-wide text-text-tertiary uppercase">Images / call</h2>
        <span className="ml-auto text-xs font-medium text-text-secondary tabular-nums">
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
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, var(--color-purple-500) 0%, var(--color-purple-500) ${((numberOfImages - 1) / (max - 1)) * 100}%, var(--color-surface-overlay) ${((numberOfImages - 1) / (max - 1)) * 100}%, var(--color-surface-overlay) 100%)
          `,
        }}
      />
      <div className="mt-1 flex justify-between text-[10px] text-text-muted tabular-nums">
        <span>1</span>
        <span>{Math.max(1, max)}</span>
      </div>
    </section>
  );
}
