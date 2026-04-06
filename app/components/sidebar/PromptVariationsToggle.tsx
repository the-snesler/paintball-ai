import { useEffect } from "react";
import { Shuffle, Info } from "lucide-react";
import { useGalleryStore } from "~/stores/galleryStore";
import { isTextModelAvailable } from "~/lib/textModel";
import { hasVariationSections } from "~/lib/promptVariations";
import { Tooltip } from "~/components/ui/Tooltip";

export function PromptVariationsToggle() {
  const modelSelections = useGalleryStore((s) => s.currentModelSelections);
  const variationsEnabled = useGalleryStore((s) => s.variationsEnabled);
  const setVariationsEnabled = useGalleryStore((s) => s.setVariationsEnabled);
  const prompt = useGalleryStore((s) => s.currentPrompt);
  const setPrompt = useGalleryStore((s) => s.setPrompt);

  const totalImages = Object.values(modelSelections).reduce((sum, count) => sum + count, 0);
  const textModelAvailable = isTextModelAvailable();
  const variationsDisabled = !textModelAvailable || totalImages <= 1;

  // Auto-disable when total drops to 1 or below
  useEffect(() => {
    if (totalImages <= 1 && variationsEnabled) {
      setVariationsEnabled(false);
    }
  }, [totalImages, variationsEnabled, setVariationsEnabled]);

  const tooltipContent = (
    <>
      <p className="mb-1.5 font-medium text-zinc-100">Prompt Variations</p>
      <p>Generate unique prompts for each image by adding variable sections to your prompt:</p>
      <code className="my-1.5 block rounded bg-zinc-900 px-2 py-1 text-zinc-400">
        {"{{sunset: vary time of day}}"}
      </code>
      <p>
        The text model will replace each{" "}
        <code className="rounded bg-zinc-900 px-1 text-zinc-400">{"{{}}"}</code> section with a
        unique variation per image.
      </p>
      {!textModelAvailable && (
        <p className="mt-1.5 text-red-500">Requires an API key for the text model.</p>
      )}
      {totalImages <= 1 && (
        <p className="mt-1.5 text-red-500">Requires 2 or more total images to generate variations.</p>
      )}
    </>
  );

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">
          <Shuffle className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
          Prompt Variations
        </span>
        <Tooltip content={tooltipContent} placement="bottom-start">
          <span className="cursor-help text-zinc-600 transition-colors hover:text-zinc-400">
            <Info className="h-3 w-3" />
          </span>
        </Tooltip>
      </div>
      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          checked={variationsEnabled}
          onChange={(e) => {
            const enabling = e.target.checked;
            setVariationsEnabled(enabling);
            if (enabling && !hasVariationSections(prompt)) {
              const suffix = prompt.length > 0 && !prompt.endsWith(" ") ? " " : "";
              setPrompt(prompt + suffix + "{{example: vary this}}");
            }
          }}
          className="peer sr-only"
          disabled={variationsDisabled}
        />
        <div className="peer h-5 w-9 rounded-full bg-zinc-700 peer-checked:bg-purple-600 peer-focus:outline-none after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-zinc-400 after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white rtl:peer-checked:after:-translate-x-full peer-disabled:cursor-not-allowed"></div>
      </label>
    </div>
  );
}
