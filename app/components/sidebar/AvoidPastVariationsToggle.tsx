import { useMemo } from "react";
import { Ban, Info } from "lucide-react";
import { useGalleryStore } from "~/stores/galleryStore";
import { useGenerationStore } from "~/stores/generationStore";
import { collectAvoidList } from "~/lib/promptVariations";
import { Tooltip } from "~/components/ui/Tooltip";
import { Switch } from "~/components/ui/Switch";

export function AvoidPastVariationsToggle() {
  const variationsEnabled = useGenerationStore((s) => s.variationsEnabled);
  const currentPrompt = useGenerationStore((s) => s.currentPrompt);
  const items = useGalleryStore((s) => s.items);
  const avoidPastVariations = useGenerationStore((s) => s.avoidPastVariations);
  const setAvoidPastVariations = useGenerationStore((s) => s.setAvoidPastVariations);

  const avoidList = useMemo(() => collectAvoidList(currentPrompt, items), [currentPrompt, items]);

  if (!variationsEnabled || !avoidList || !avoidList.some((list) => list.length > 0)) {
    return null;
  }

  const totalCount = avoidList.reduce((sum, list) => sum + list.length, 0);
  const sectionsWithHistory = avoidList.filter((list) => list.length > 0).length;

  const tooltipContent = (
    <>
      <p className="mb-1.5 font-medium text-zinc-100">Avoid Past Variations</p>
      <p>
        When enabled, previously-generated variations for this exact prompt are sent to the text
        model with instructions not to repeat them.
      </p>
      <p className="mt-1.5">
        Found {totalCount} past variation{totalCount === 1 ? "" : "s"} across {sectionsWithHistory}{" "}
        section{sectionsWithHistory === 1 ? "" : "s"}.
      </p>
      <p className="mt-1.5">
        Edit the prompt to start fresh — this toggle disappears as soon as the prompt no longer
        matches a past run.
      </p>
    </>
  );

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">
          <Ban className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
          Avoid Past Variations
        </span>
        <Tooltip content={tooltipContent} placement="bottom-start">
          <span className="cursor-help text-zinc-600 transition-colors hover:text-zinc-400">
            <Info className="h-3 w-3" />
          </span>
        </Tooltip>
      </div>
      <Switch
        checked={avoidPastVariations}
        onChange={(e) => setAvoidPastVariations(e.target.checked)}
        aria-label="Toggle avoiding past variations"
      />
    </div>
  );
}
