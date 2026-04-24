import { Sparkles, Loader2, KeyRound } from "lucide-react";
import { useNavigate } from "react-router";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { useImageGeneration } from "~/hooks/useImageGeneration";
import { buildGenerationSignature } from "~/lib/generationSignature";
import { getModel } from "~/lib/models";
import { hasProviderAccess } from "~/lib/providers";
import { hasVariationSections } from "~/lib/promptVariations";
import NumberFlow from "@number-flow/react";

export function GenerateButton() {
  const prompt = useGenerationStore((s) => s.currentPrompt);
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const lastSubmittedSignature = useGenerationStore((s) => s.lastSubmittedSignature);
  const activeGenerationSignatures = useGenerationStore((s) => s.activeGenerationSignatures);
  const aspectRatio = useGenerationStore((s) => s.currentAspectRatio);
  const resolution = useGenerationStore((s) => s.currentResolution);
  const referenceImages = useGenerationStore((s) => s.currentReferenceImages);
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
    return model && !hasProviderAccess(apiKeys, model.provider);
  });

  const currentSignature = buildGenerationSignature({
    prompt,
    modelSelections,
    aspectRatio,
    resolution,
    referenceImages,
  });

  const isLastSubmittedActive =
    lastSubmittedSignature !== null &&
    (activeGenerationSignatures[lastSubmittedSignature] ?? 0) > 0;

  const isLockedForCurrentParams =
    isLastSubmittedActive && lastSubmittedSignature === currentSignature;

  const variationsEnabled = useGenerationStore((s) => s.variationsEnabled);
  const variationsBlocking = variationsEnabled && !hasVariationSections(prompt);

  const canGenerate =
    prompt.trim().length > 0 && totalImages > 0 && !isLockedForCurrentParams && !variationsBlocking;

  const canClear = prompt.trim().length !== 0 || totalImages > 0;

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
    useGenerationStore.getState().resetDraft();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="group relative flex-1">
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-purple-800 transition group-hover:bg-purple-600"></div>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 font-medium transition-all ${
            canGenerate
              ? "-translate-y-1 cursor-pointer border-purple-500 bg-purple-600 text-white shadow-lg hover:-translate-y-2 hover:border-purple-400 hover:bg-purple-500 active:translate-y-0"
              : "translate-y-0 cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500"
          }`}
        >
          {isLockedForCurrentParams ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : missingKeys ? (
            <>
              <KeyRound className="h-4 w-4" />
              Missing keys
            </>
          ) : variationsBlocking ? (
            <>
              <Sparkles className="h-4 w-4" />
              {"Add {{variations}}"}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate
            </>
          )}
        </button>
      </div>
      <div className="flex w-full justify-center">
        <span className="text-xs text-zinc-400">
          <NumberFlow
            value={totalImages}
            format={{ useGrouping: false }}
            transformTiming={{ duration: 300, easing: "ease-out" }}
            spinTiming={{ duration: 300, easing: "ease-out" }}
            opacityTiming={{ duration: 150, easing: "ease-out" }}
            willChange
          />
          {" pending"}
          {" • "}
          <button
            onClick={handleClear}
            disabled={!canClear}
            className="text-center text-red-400 hover:cursor-pointer hover:underline disabled:text-zinc-400 disabled:hover:cursor-not-allowed disabled:hover:no-underline"
          >
            Clear
          </button>
        </span>
      </div>
    </div>
  );
}
