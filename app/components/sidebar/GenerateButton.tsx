import { Sparkles, Loader2 } from "lucide-react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { useImageGeneration } from "~/hooks/useImageGeneration";
import { getModel } from "~/lib/models";

export function GenerateButton() {
  const prompt = useGalleryStore((s) => s.currentPrompt);
  const modelSelections = useGalleryStore((s) => s.currentModelSelections);
  const aspectRatio = useGalleryStore((s) => s.currentAspectRatio);
  const isGenerating = useGalleryStore((s) => s.isGenerating);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const openSettingsModal = useSettingsStore((s) => s.openSettingsModal);

  const { generate } = useImageGeneration();

  // Calculate stats
  const activeModels = Object.entries(modelSelections).filter(([, count]) => count > 0);
  const totalImages = activeModels.reduce((sum, [, count]) => sum + count, 0);

  // Check if we have API keys for selected models
  const missingKeys = activeModels.some(([modelId]) => {
    const model = getModel(modelId);
    return model && !apiKeys[model.apiKeyRequired];
  });

  const canGenerate =
    prompt.trim().length > 0 && totalImages > 0 && !missingKeys && !isGenerating;

  const handleGenerate = () => {
    if (missingKeys) {
      openSettingsModal();
      return;
    }
    if (canGenerate) {
      generate();
    }
  };

  // Status text
  let statusText = "";
  if (totalImages > 0) {
    const modelCount = activeModels.length;
    statusText = `${modelCount} model${modelCount !== 1 ? "s" : ""} · ${aspectRatio}`;
  }

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
        {isGenerating ? (
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
      {statusText && (
        <p className="text-center text-xs text-zinc-500 mt-2">{statusText}</p>
      )}
    </div>
  );
}
