import { Sparkles, Loader2, KeyRound } from "lucide-react";
import { useNavigate } from "react-router";
import { DEFAULT_GENERATION_STATE, useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { useImageGeneration } from "~/hooks/useImageGeneration";
import { buildGenerationSignature } from "~/lib/generationSignature";
import { getModel } from "~/lib/models";
import NumberFlow from "@number-flow/react";

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
  const navigate = useNavigate();

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
    prompt.trim().length > 0 && totalImages > 0 && !isLockedForCurrentParams;

  const canClear = prompt.trim().length !== 0 || totalImages > 0

  const handleGenerate = () => {
    if (missingKeys) {
      navigate("/settings");
      return;
    }
    if (canGenerate) {
      generate();
    }
  };

  const handleClear = () => {
    useGalleryStore.setState(DEFAULT_GENERATION_STATE);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative group flex-1">
        <div className="bg-purple-800 rounded-lg absolute inset-0 pointer-events-none group-hover:bg-purple-600 transition"></div>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all border-2 ${
            canGenerate
              ? "bg-purple-600 hover:bg-purple-500 text-white border-purple-500 hover:border-purple-400 -translate-y-1 active:translate-y-0 hover:-translate-y-2 shadow-lg cursor-pointer "
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed border-zinc-700 translate-y-0"
          }`}
        >
          {isLockedForCurrentParams ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : missingKeys ? (
            <>
              <KeyRound className="w-4 h-4" />
              Missing keys
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate
            </>
          )}
        </button>
      </div>
      <div className="w-full flex justify-center">
        <span className="text-xs text-zinc-400">
          <NumberFlow
              value={totalImages}
              format={{ useGrouping: false }}
              transformTiming={{ duration: 300, easing: 'ease-out' }}
              spinTiming={{ duration: 300, easing: 'ease-out' }}
              opacityTiming={{ duration: 150, easing: 'ease-out' }}
              willChange
            />{" pending"}
          {" • "}
          <button
            onClick={handleClear}
            disabled={!canClear}
            className="disabled:text-zinc-400 text-center disabled:hover:no-underline hover:underline text-red-400 hover:cursor-pointer disabled:hover:cursor-not-allowed"
          >
            Clear
          </button>
        </span>
      </div>
    </div>
  );
}
