import { Sparkles, Loader2 } from "lucide-react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { useImageGeneration } from "~/hooks/useImageGeneration";
import { buildGenerationSignature } from "~/lib/generationSignature";
import { getModel } from "~/lib/models";
import { SETTINGS_POPOVER_ID } from "../settings/SettingsModal";

export function GenerateButton() {
  const prompt = useGalleryStore((s) => s.currentPrompt);
  const modelSelections = useGalleryStore((s) => s.currentModelSelections);
  const lastSubmittedSignature = useGalleryStore((s) => s.lastSubmittedSignature);
  const activeGenerationSignatures = useGalleryStore((s) => s.activeGenerationSignatures);
  const aspectRatio = useGalleryStore((s) => s.currentAspectRatio);
  const resolution = useGalleryStore((s) => s.currentResolution);
  const referenceImages = useGalleryStore((s) => s.currentReferenceImages);
  const models = useSettingsStore((s) => s.models);
  const apiKeys = useSettingsStore((s) => s.apiKeys);

  const { generate } = useImageGeneration();

  // Calculate stats
  const activeModels = Object.entries(modelSelections).filter(([, count]) => count > 0);
  const totalImages = activeModels.reduce((sum, [, count]) => sum + count, 0);

  // Check if we have API keys for selected models
  const missingKeys = activeModels.some(([modelId]) => {
    const model = getModel(models, modelId);
    return model && !apiKeys[model.provider];
  });

  const currentSignature = buildGenerationSignature({
    prompt,
    modelSelections,
    aspectRatio,
    resolution,
    referenceImages,
  });

  const isLastSubmittedActive =
    lastSubmittedSignature !== null && (activeGenerationSignatures[lastSubmittedSignature] ?? 0) > 0;

  const isLockedForCurrentParams =
    isLastSubmittedActive && lastSubmittedSignature === currentSignature;

  const canGenerate =
    prompt.trim().length > 0 && totalImages > 0 && !missingKeys && !isLockedForCurrentParams;

  const handleGenerate = () => {
    if (missingKeys) {
      const settingsPopover = document.getElementById(SETTINGS_POPOVER_ID);
      settingsPopover?.showPopover();
      return;
    }
    if (canGenerate) {
      generate();
    }
  };

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={!canGenerate && !missingKeys}
        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
          canGenerate || missingKeys
            ? "bg-purple-600 hover:bg-purple-500 text-white"
            : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
        }`}
      >
        {isLockedForCurrentParams ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate
          </>
        )}
      </button>
    </div>
  );
}
