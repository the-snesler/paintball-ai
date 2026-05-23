import { BarChart3, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GalleryHeader } from "~/components/gallery/GalleryHeader";
import { getAllImages } from "~/lib/db";
import { SCORECARD_CRITERIA } from "~/lib/scorecard";
import type { ScorecardCriterion, StoredImageRecord } from "~/types";

type ModelStats = {
  modelId: string;
  modelName: string;
  ratedImages: number;
  totalImages: number;
  overallAverage: number;
  criterionAverages: Partial<Record<ScorecardCriterion, number>>;
  averageGenerationTimeMs: number | null;
};

export default function StatsRoute() {
  const [images, setImages] = useState<StoredImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getAllImages()
      .then((records) => {
        if (!cancelled) setImages(records);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load stats");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => buildModelStats(images), [images]);
  const ratedImageCount = stats.reduce((sum, model) => sum + model.ratedImages, 0);

  return (
    <main className="bg-surface flex h-full flex-1 flex-col overflow-hidden">
      <GalleryHeader title="Stats" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="text-text-muted flex h-full items-center justify-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading stats...
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : ratedImageCount === 0 ? (
          <EmptyStatsState />
        ) : (
          <div className="mx-auto max-w-6xl space-y-6">
            {ratedImageCount < 10 && (
              <div className="border-c-border bg-surface-raised rounded-lg border px-4 py-3">
                <p className="text-text-secondary text-sm">
                  Early signal: {ratedImageCount} rated image{ratedImageCount === 1 ? "" : "s"}.
                  Rankings will get steadier as you score more outputs.
                </p>
              </div>
            )}
            <ModelScorecardsTable stats={stats} />
            <FutureStats />
          </div>
        )}
      </div>
    </main>
  );
}

function ModelScorecardsTable({ stats }: { stats: ModelStats[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-text-secondary text-sm font-medium">Model scorecards</h2>
        <span className="text-text-muted text-xs">
          {stats.length} model{stats.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="border-c-border overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead className="bg-surface-raised">
            <tr className="border-c-border border-b">
              <th className="text-text-muted px-3 py-2 text-xs font-medium">Model</th>
              <th className="text-text-muted px-3 py-2 text-xs font-medium">Overall</th>
              <th className="text-text-muted px-3 py-2 text-xs font-medium">Rated</th>
              <th className="text-text-muted px-3 py-2 text-xs font-medium">Avg time</th>
              {SCORECARD_CRITERIA.map(({ key, shortLabel }) => (
                <th key={key} className="text-text-muted px-3 py-2 text-xs font-medium">
                  {shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((model) => (
              <tr key={model.modelId} className="border-c-border/60 border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-text-secondary truncate text-sm font-medium">
                      {model.modelName}
                    </p>
                    <p className="text-text-muted truncate text-xs">{model.modelId}</p>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="text-sm font-medium text-amber-200">
                    {model.overallAverage.toFixed(1)}
                  </span>
                </td>
                <td className="text-text-secondary px-3 py-2 text-sm">
                  {model.ratedImages}/{model.totalImages}
                </td>
                <td className="text-text-secondary px-3 py-2 text-sm">
                  {model.averageGenerationTimeMs == null
                    ? "-"
                    : `${(model.averageGenerationTimeMs / 1000).toFixed(1)}s`}
                </td>
                {SCORECARD_CRITERIA.map(({ key }) => (
                  <td key={key} className="text-text-secondary px-3 py-2 text-sm">
                    {model.criterionAverages[key] == null
                      ? "-"
                      : model.criterionAverages[key]?.toFixed(1)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyStatsState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="bg-surface-raised mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <BarChart3 className="text-text-muted h-8 w-8" />
      </div>
      <h3 className="text-text-secondary mb-2 text-lg font-medium">No rated images yet</h3>
      <p className="text-text-muted max-w-sm text-sm">
        Open a generated image, score it in the lightbox, and Paintball will start ranking models
        for your taste.
      </p>
    </div>
  );
}

function FutureStats() {
  return (
    <section className="space-y-3">
      <h2 className="text-text-secondary flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        Future stats
      </h2>
      <div className="grid gap-2 md:grid-cols-2">
        {[
          "Prompt/category clustering",
          "Provider spend estimates",
          "Win-rate comparisons for same-prompt outputs",
          "Style and character-specific recommendations",
        ].map((item) => (
          <div
            key={item}
            className="border-c-border bg-surface-raised text-text-secondary rounded-lg border px-3 py-2 text-sm"
          >
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function buildModelStats(images: StoredImageRecord[]): ModelStats[] {
  const grouped = new Map<
    string,
    {
      modelName: string;
      totalImages: number;
      ratedImageIds: Set<string>;
      scores: Record<ScorecardCriterion, number[]>;
      generationTimes: number[];
    }
  >();

  for (const image of images) {
    const existing = grouped.get(image.modelId) ?? {
      modelName: image.modelName,
      totalImages: 0,
      ratedImageIds: new Set<string>(),
      scores: createScoreBuckets(),
      generationTimes: [],
    };

    existing.modelName = image.modelName;
    existing.totalImages += 1;
    if (typeof image.generationTimeMs === "number")
      existing.generationTimes.push(image.generationTimeMs);

    for (const { key } of SCORECARD_CRITERIA) {
      const value = image.scorecard?.scores[key];
      if (typeof value === "number") {
        existing.scores[key].push(value);
        existing.ratedImageIds.add(image.id);
      }
    }

    grouped.set(image.modelId, existing);
  }

  return Array.from(grouped.entries())
    .map(([modelId, group]) => {
      const criterionAverages: Partial<Record<ScorecardCriterion, number>> = {};
      const allScores: number[] = [];

      for (const { key } of SCORECARD_CRITERIA) {
        const values = group.scores[key];
        if (values.length === 0) continue;
        criterionAverages[key] = average(values);
        allScores.push(...values);
      }

      if (allScores.length === 0) return null;

      return {
        modelId,
        modelName: group.modelName,
        ratedImages: group.ratedImageIds.size,
        totalImages: group.totalImages,
        overallAverage: average(allScores),
        criterionAverages,
        averageGenerationTimeMs:
          group.generationTimes.length === 0 ? null : average(group.generationTimes),
      };
    })
    .filter((entry): entry is ModelStats => entry != null)
    .sort((a, b) => b.overallAverage - a.overallAverage || b.ratedImages - a.ratedImages);
}

function createScoreBuckets(): Record<ScorecardCriterion, number[]> {
  return {
    likeness: [],
    promptAdherence: [],
    aesthetics: [],
    textAccuracy: [],
    speed: [],
    cost: [],
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
