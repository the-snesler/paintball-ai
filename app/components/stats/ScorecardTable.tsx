import clsx from "clsx";
import { SCORECARD_CRITERIA } from "~/lib/scorecard";
import type { ModelScoreStats } from "~/lib/stats";
import { ChartCard } from "./ChartCard";

/** Per-model average of lightbox scorecard ratings, best first. */
export function ScorecardTable({
  stats,
  colorFor,
}: {
  stats: ModelScoreStats[];
  colorFor: (seriesKey: string) => string;
}) {
  const ratedImageCount = stats.reduce((sum, model) => sum + model.ratedImages, 0);

  return (
    <ChartCard
      title="Model scorecards"
      subtitle={
        ratedImageCount < 10
          ? `Early signal: ${ratedImageCount} rated image${ratedImageCount === 1 ? "" : "s"} — rankings steady as you score more`
          : `${ratedImageCount} rated images across ${stats.length} model${stats.length === 1 ? "" : "s"}`
      }
    >
      <div className="-mx-4 overflow-x-auto md:-mx-5">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-c-border border-b">
              <th className="text-text-muted px-4 py-2 text-xs font-medium md:pl-5">Model</th>
              <th className="text-text-muted px-3 py-2 text-xs font-medium">Overall</th>
              <th className="text-text-muted px-3 py-2 text-xs font-medium">Rated</th>
              {SCORECARD_CRITERIA.map(({ key, shortLabel }) => (
                <th key={key} className="text-text-muted px-3 py-2 text-xs font-medium">
                  {shortLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((model) => (
              <tr key={model.modelId} className="border-border-subtle border-b last:border-b-0">
                <td className="px-4 py-2 md:pl-5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: colorFor(model.seriesKey) }}
                    />
                    <span className="text-text-secondary truncate text-sm font-medium">
                      {model.modelName}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <ScoreCell value={model.overallAverage} strong />
                </td>
                <td className="text-text-tertiary px-3 py-2 text-sm tabular-nums">
                  {model.ratedImages}/{model.totalImages}
                </td>
                {SCORECARD_CRITERIA.map(({ key }) => (
                  <td key={key} className="px-3 py-2">
                    <ScoreCell value={model.criterionAverages[key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

/** Score with an inline 0–5 meter so columns scan visually as well as numerically. */
function ScoreCell({ value, strong = false }: { value: number | undefined; strong?: boolean }) {
  if (value == null) return <span className="text-text-muted text-sm">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          "w-7 text-sm tabular-nums",
          strong ? "text-text-primary font-semibold" : "text-text-secondary"
        )}
      >
        {value.toFixed(1)}
      </span>
      <span className="bg-surface-overlay hidden h-1 w-10 overflow-hidden rounded-full sm:block">
        <span
          className="bg-accent block h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(1, value / 5)) * 100}%` }}
        />
      </span>
    </div>
  );
}
