import { Accordion } from "@base-ui/react/accordion";
import { ChevronDown, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createScorecard, getScorecardRatingCount, SCORECARD_CRITERIA } from "~/lib/scorecard";
import { useGalleryStore } from "~/stores/galleryStore";
import type { CompletedGalleryItem, ScorecardCriterion } from "~/types";

interface ScorecardPanelProps {
  image: CompletedGalleryItem;
}

export function ScorecardPanel({ image }: ScorecardPanelProps) {
  const updateScorecard = useGalleryStore((s) => s.updateScorecard);
  const [savingCriterion, setSavingCriterion] = useState<ScorecardCriterion | null>(null);

  const scores = image.scorecard?.scores;
  const ratingCount = getScorecardRatingCount(image.scorecard);

  const summary = useMemo(() => {
    if (ratingCount === 0) return "No scores yet";
    return `${ratingCount}/${SCORECARD_CRITERIA.length} scored`;
  }, [ratingCount]);

  const setCriterionScore = async (criterion: ScorecardCriterion, value: number | null) => {
    setSavingCriterion(criterion);
    try {
      const nextScores = createScorecard({
        ...scores,
        [criterion]: value,
      }).scores;

      const hasAnyScore = SCORECARD_CRITERIA.some(({ key }) => typeof nextScores[key] === "number");
      await updateScorecard(image.id, hasAnyScore ? createScorecard(nextScores) : undefined);
    } finally {
      setSavingCriterion(null);
    }
  };

  return (
    <Accordion.Root className="bg-surface-overlay/50 rounded-lg">
      <Accordion.Item>
        <Accordion.Header>
          <Accordion.Trigger className="group flex w-full cursor-pointer list-none items-center justify-between gap-3 p-3 text-left [&::-webkit-details-marker]:hidden">
            <span className="text-text-tertiary text-xs font-medium">Scorecard</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-text-muted text-xs">{summary}</span>
              <ChevronDown className="text-text-muted group-hover:text-text-tertiary h-4 w-4 -rotate-90 transition-transform duration-200 group-data-panel-open:rotate-0" />
            </span>
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className="h-(--accordion-panel-height) p-3 overflow-hidden transition-[height] data-ending-style:h-0 data-starting-style:h-0">
          <div className="mt-3 space-y-2">
            {SCORECARD_CRITERIA.map(({ key, label }) => {
              const value = scores?.[key] ?? null;
              const isSaving = savingCriterion === key;
              return (
                <div
                  key={key}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2"
                >
                  <span className="text-text-secondary truncate text-xs">{label}</span>
                  <div className="flex items-center gap-0.5" aria-label={`${label} score`}>
                    {[1, 2, 3, 4, 5].map((score) => {
                      const selected = value != null && score <= value;
                      return (
                        <button
                          key={score}
                          type="button"
                          onClick={() => void setCriterionScore(key, score)}
                          disabled={isSaving}
                          aria-label={`${label}: ${score} out of 5`}
                          title={`${score} out of 5`}
                          className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:cursor-wait ${selected
                            ? "text-amber-300 hover:bg-amber-300/10"
                            : "text-text-muted hover:bg-surface-overlay hover:text-text-secondary"
                            }`}
                        >
                          <Star className={`h-3.5 w-3.5 ${selected ? "fill-current" : ""}`} />
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => void setCriterionScore(key, null)}
                    disabled={value == null || isSaving}
                    aria-label={`Clear ${label} score`}
                    title={`Clear ${label}`}
                    className="text-text-muted hover:bg-surface-overlay hover:text-text-secondary flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-25"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}
