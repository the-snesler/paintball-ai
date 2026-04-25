import { useEffect } from "react";
import { Shuffle, Info } from "lucide-react";
import { useGenerationStore } from "~/stores/generationStore";
import { isTextModelAvailable } from "~/lib/textModel";
import { hasVariationSections } from "~/lib/promptVariations";
import { Tooltip } from "~/components/ui/Tooltip";
import { Switch } from "~/components/ui/Switch";

export function PromptVariationsToggle() {
  const modelSelections = useGenerationStore((s) => s.currentModelSelections);
  const variationsEnabled = useGenerationStore((s) => s.variationsEnabled);
  const setVariationsEnabled = useGenerationStore((s) => s.setVariationsEnabled);
  const prompt = useGenerationStore((s) => s.currentPrompt);
  const setPrompt = useGenerationStore((s) => s.setPrompt);

  const totalImages = Object.values(modelSelections).reduce((sum, count) => sum + count, 0);
  const variationsDisabled = !isTextModelAvailable();

  useEffect(() => {
    if (!variationsEnabled) {
      setVariationsEnabled(false);
    }
  }, [totalImages, variationsEnabled, setVariationsEnabled]);

  const tooltipContent = (
    <>
      <p className="mb-1.5 font-medium text-text-primary">Prompt Variations</p>
      <p>Generate unique prompts for each image by adding variable sections to your prompt:</p>
      <code className="my-1.5 block rounded bg-surface-raised px-2 py-1 text-text-tertiary">
        {"{{sunset: vary time of day}}"}
      </code>
      <p>
        The text model will replace each{" "}
        <code className="rounded bg-surface-raised px-1 text-text-tertiary">{"{{}}"}</code> section with a
        unique variation per image. It will use the example text before the colon as a base for
        generating variations, and the text after the colon as instructions for how to vary it.
      </p>
      <p>
        You can add as many variable sections as you like! Prompt variations require a text model
        configured in settings.
      </p>
      {!variationsDisabled && (
        <p className="mt-1.5 text-red-500">Requires an API key for the text model.</p>
      )}
    </>
  );

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-text-muted">
          <Shuffle className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium tracking-wide text-text-tertiary uppercase">
          Prompt Variations
        </span>
        <Tooltip content={tooltipContent} placement="bottom-start">
          <span className="cursor-help text-text-muted transition-colors hover:text-text-tertiary">
            <Info className="h-3 w-3" />
          </span>
        </Tooltip>
      </div>
      <Switch
        checked={variationsEnabled}
        onChange={(e) => {
          const enabling = e.target.checked;
          setVariationsEnabled(enabling);
          if (enabling && !hasVariationSections(prompt)) {
            const suffix = prompt.length > 0 && !prompt.endsWith(" ") ? " " : "";
            setPrompt(prompt + suffix + "{{example: vary this}}");
          }
        }}
        disabled={variationsDisabled}
        aria-label="Toggle prompt variations"
      />
    </div>
  );
}
