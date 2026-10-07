import NumberFlow from "@number-flow/react";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  Flame,
  ImagePlus,
  Images,
  Loader2,
  Shuffle,
  Sparkles,
  Type,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GalleryHeader } from "~/components/gallery/GalleryHeader";
import { ActivityHeatmap } from "~/components/stats/ActivityHeatmap";
import { BarList, type BarListItem } from "~/components/stats/BarList";
import {
  ChartCard,
  EmptyChart,
  Legend,
  SegmentedControl,
  type ChartTable,
} from "~/components/stats/ChartCard";
import { seriesColor, useChartTheme, type ChartTheme } from "~/components/stats/chartTheme";
import {
  formatBucket,
  formatCount,
  formatDuration,
  formatMoney,
  formatPercent,
} from "~/components/stats/format";
import { ScorecardTable } from "~/components/stats/ScorecardTable";
import { ShareDonut, type DonutSlice } from "~/components/stats/ShareDonut";
import { StatTile } from "~/components/stats/StatTile";
import { TimelineChart } from "~/components/stats/TimelineChart";
import { TimingChart } from "~/components/stats/TimingChart";
import { getImageStatRecords } from "~/lib/db";
import {
  OTHER_SERIES_KEY,
  STATS_RANGES,
  assignModelSeries,
  buildModelScoreStats,
  computeStats,
  getRangeStart,
  type CountEntry,
  type ImageStatRecord,
  type ModelSeries,
  type StatsRangeKey,
  type StatsSummary,
} from "~/lib/stats";
import { useSettingsStore } from "~/stores/settingsStore";

const MAX_DONUT_SLICES = 6;

export default function StatsRoute() {
  const [records, setRecords] = useState<ImageStatRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<StatsRangeKey>("all");

  useEffect(() => {
    let cancelled = false;
    getImageStatRecords()
      .then((result) => {
        if (!cancelled) setRecords(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load stats");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="bg-surface flex h-full flex-1 flex-col overflow-hidden">
      <GalleryHeader title="Stats" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {error ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : !records ? (
          <div className="text-text-muted flex h-full items-center justify-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Crunching numbers...
          </div>
        ) : records.length === 0 ? (
          <EmptyStatsState />
        ) : (
          <StatsDashboard records={records} range={range} onRangeChange={setRange} />
        )}
      </div>
    </main>
  );
}

function StatsDashboard({
  records,
  range,
  onRangeChange,
}: {
  records: ImageStatRecord[];
  range: StatsRangeKey;
  onRangeChange: (range: StatsRangeKey) => void;
}) {
  const theme = useChartTheme();
  const characters = useSettingsStore((s) => s.characters);
  const styles = useSettingsStore((s) => s.styles);

  // Colors are assigned from all-time usage so they stay put when the range changes.
  const { series, keyByModelId } = useMemo(() => assignModelSeries(records), [records]);
  const seriesKeys = useMemo(() => series.map((s) => s.key), [series]);
  const stats = useMemo(
    () => computeStats(records, range, keyByModelId, seriesKeys),
    [records, range, keyByModelId, seriesKeys]
  );
  const scoreStats = useMemo(() => {
    const start = getRangeStart(range);
    const inRange = start == null ? records : records.filter((r) => r.createdAt >= start);
    return buildModelScoreStats(inRange, keyByModelId);
  }, [records, range, keyByModelId]);

  const characterNames = useMemo(
    () => new Map(characters.map((c) => [c.id, c.name])),
    [characters]
  );
  const styleNames = useMemo(() => new Map(styles.map((s) => [s.id, s.name])), [styles]);

  // Only show series that actually have data in this range, in stable slot order.
  const activeSeries = useMemo(() => {
    const present = new Set(stats.models.map((m) => m.seriesKey));
    return series.filter((s) => present.has(s.key));
  }, [series, stats.models]);

  const rangeMeta = STATS_RANGES.find((r) => r.key === range)!;
  const { totals } = stats;

  if (totals.images === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <FilterRow range={range} onRangeChange={onRangeChange} stats={stats} />
        <div className="border-c-border/70 bg-surface-raised text-text-muted rounded-xl border px-4 py-16 text-center text-sm">
          No images in this period. Try a wider range.
        </div>
      </div>
    );
  }

  const delta = (current: number, previous: number | undefined) =>
    stats.previous && previous != null && previous > 0
      ? { value: (current - previous) / previous, period: rangeMeta.label }
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <FilterRow range={range} onRangeChange={onRangeChange} stats={stats} />

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatTile
          hero
          className="col-span-2 lg:row-span-2"
          label="Total spend"
          value={
            <NumberFlow
              value={totals.spend}
              format={{
                style: "currency",
                currency: "USD",
                maximumFractionDigits: totals.spend < 10 ? 2 : 0,
              }}
            />
          }
          delta={delta(totals.spend, stats.previous?.spend)}
          hint={
            totals.costedImages < totals.images
              ? `${formatCount(totals.costedImages)} of ${formatCount(totals.images)} images priced`
              : undefined
          }
          trend={stats.timeline.map((p) => p.spend)}
          trendColor={theme.sequential}
        />
        <StatTile
          className="col-span-2"
          label="Images generated"
          value={<NumberFlow value={totals.images} />}
          delta={delta(totals.images, stats.previous?.images)}
          trend={stats.timeline.map((p) => p.images)}
          trendColor={theme.sequential}
        />
        <StatTile
          className="col-span-2"
          label="Avg cost per image"
          value={totals.avgCost == null ? "—" : formatMoney(totals.avgCost)}
          hint={
            totals.avgCost != null
              ? `${formatCount(Math.floor(1 / totals.avgCost))} images per $1`
              : undefined
          }
        />
        <StatTile
          label="Median gen time"
          value={totals.medianTimeMs == null ? "—" : formatDuration(totals.medianTimeMs)}
        />
        <StatTile
          label="Favorites"
          value={<NumberFlow value={totals.favorites} />}
          hint={`${formatPercent(totals.favorites, totals.images)} keep rate`}
        />
        <StatTile
          label="Active days"
          value={<NumberFlow value={totals.activeDays} />}
          hint={`${formatCount(Math.round(totals.images / Math.max(1, totals.activeDays)))} images / day`}
        />
        <StatTile
          className="col-span-1 md:col-span-3 lg:col-span-1"
          label="Top model"
          value={<span className="block truncate text-xl">{stats.models[0].name}</span>}
          hint={`${formatPercent(stats.models[0].images, totals.images)} of images`}
        />
      </div>

      {/* Spend */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Spend over time"
          subtitle={`Estimated USD per ${stats.granularity}, by model`}
          legend={<SeriesLegend series={activeSeries} theme={theme} />}
          table={timelineTable(stats, activeSeries, "spend")}
        >
          <TimelineChart
            data={stats.timeline}
            series={activeSeries}
            metric="spend"
            granularity={stats.granularity}
          />
        </ChartCard>
        <ChartCard
          title="Spend by model"
          subtitle="Total · average per image"
          table={{
            columns: ["Model", "Spend", "Images", "Avg / image"],
            rows: stats.models.map((m) => [
              m.name,
              formatMoney(m.spend),
              m.images,
              m.avgCost == null ? "—" : formatMoney(m.avgCost),
            ]),
          }}
        >
          <BarList
            items={[...stats.models]
              .filter((m) => m.costedImages > 0)
              .sort((a, b) => b.spend - a.spend)
              .map<BarListItem>((m) => ({
                key: m.modelId,
                label: m.name,
                value: m.spend,
                display: formatMoney(m.spend),
                detail: m.avgCost == null ? undefined : `${formatMoney(m.avgCost)}/img`,
                color: seriesColor(theme, m.seriesKey),
              }))}
          />
          {stats.models.every((m) => m.costedImages === 0) && (
            <EmptyChart>No cost estimates recorded in this period.</EmptyChart>
          )}
        </ChartCard>
      </div>

      {/* Model preference */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Model usage over time"
          subtitle={`Images per ${stats.granularity}, by model`}
          legend={<SeriesLegend series={activeSeries} theme={theme} />}
          table={timelineTable(stats, activeSeries, "images")}
        >
          <TimelineChart
            data={stats.timeline}
            series={activeSeries}
            metric="images"
            granularity={stats.granularity}
          />
        </ChartCard>
        <ChartCard
          title="Model share"
          subtitle={`${totals.models} model${totals.models === 1 ? "" : "s"} used`}
          table={{
            columns: ["Model", "Images", "Share", "Favorites"],
            rows: stats.models.map((m) => [
              m.name,
              m.images,
              formatPercent(m.images, totals.images),
              m.favorites,
            ]),
          }}
        >
          <ShareDonut
            slices={donutSlices(stats, theme)}
            centerLabel="images"
            surface={theme.surface}
          />
        </ChartCard>
      </div>

      {/* Speed & subjects */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Generation time"
          subtitle="Per model, wall-clock from request to image"
          table={{
            columns: ["Model", "Median", "p25", "p75", "p90", "Fastest", "Samples"],
            rows: stats.models
              .filter((m) => m.timing)
              .map((m) => [
                m.name,
                formatDuration(m.timing!.median),
                formatDuration(m.timing!.p25),
                formatDuration(m.timing!.p75),
                formatDuration(m.timing!.p90),
                formatDuration(m.timing!.min),
                m.timing!.n,
              ]),
          }}
        >
          {stats.models.some((m) => m.timing) ? (
            <TimingChart
              surface={theme.surface}
              rows={stats.models
                .filter((m) => m.timing)
                .sort((a, b) => a.timing!.median - b.timing!.median)
                .map((m) => ({
                  key: m.modelId,
                  name: m.name,
                  color: seriesColor(theme, m.seriesKey),
                  timing: m.timing!,
                }))}
            />
          ) : (
            <EmptyChart>No timing data recorded in this period.</EmptyChart>
          )}
        </ChartCard>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <SubjectCard
            title="Characters"
            entries={stats.characters}
            names={characterNames}
            fallback="Deleted character"
            withCount={totals.withCharacter}
            total={totals.images}
            color={theme.sequential}
            emptyText="No characters used in this period."
          />
          <SubjectCard
            title="Styles"
            entries={stats.styles}
            names={styleNames}
            fallback="Deleted style"
            withCount={totals.withStyle}
            total={totals.images}
            color={theme.sequential}
            emptyText="No styles used in this period."
          />
        </div>
      </div>

      {/* Habits */}
      <div className="grid gap-5 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-3"
          title="When you create"
          subtitle="Images by day of week and hour (local time)"
          table={{
            columns: ["Day", ...Array.from({ length: 24 }, (_, h) => `${h}h`)],
            rows: stats.heatmap.map((row, i) => [
              ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
              ...row,
            ]),
          }}
        >
          <ActivityHeatmap grid={stats.heatmap} max={stats.heatmapMax} color={theme.sequential} />
        </ChartCard>
        <ChartCard
          className="lg:col-span-2"
          title="Output formats"
          subtitle="Aspect ratio and resolution requested"
          table={{
            columns: ["Format", "Images", "Share"],
            rows: [...stats.aspectRatios, ...stats.resolutions].map((e) => [
              e.key,
              e.count,
              formatPercent(e.count, totals.images - totals.upscales),
            ]),
          }}
        >
          <div className="space-y-5">
            <BarList
              initialVisible={5}
              items={stats.aspectRatios.map((e) => ({
                key: e.key,
                label: e.key,
                icon: <RatioGlyph ratio={e.key} />,
                value: e.count,
                display: formatCount(e.count),
                detail: formatPercent(e.count, totals.images - totals.upscales),
                color: theme.sequential,
              }))}
            />
            {stats.resolutions.length > 1 && (
              <div className="border-border-subtle border-t pt-4">
                <BarList
                  initialVisible={4}
                  items={stats.resolutions.map((e) => ({
                    key: e.key,
                    label: e.key,
                    value: e.count,
                    display: formatCount(e.count),
                    detail: formatPercent(e.count, totals.images - totals.upscales),
                    color: theme.sequential,
                  }))}
                />
              </div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Fun facts & vocabulary */}
      <div className="grid gap-5 lg:grid-cols-5">
        <ChartCard className="lg:col-span-2" title="Fun facts">
          <FunFacts stats={stats} />
        </ChartCard>
        <ChartCard
          className="lg:col-span-3"
          title="Prompt vocabulary"
          subtitle={`Most-used words · ${Math.round(totals.avgPromptWords)} words per prompt on average`}
          table={{
            columns: ["Word", "Prompts"],
            rows: stats.topWords.map((w) => [w.word, w.count]),
          }}
        >
          <WordCloud words={stats.topWords} />
        </ChartCard>
      </div>

      {scoreStats.length > 0 && (
        <ScorecardTable stats={scoreStats} colorFor={(key) => seriesColor(theme, key)} />
      )}
    </div>
  );
}

function FilterRow({
  range,
  onRangeChange,
  stats,
}: {
  range: StatsRangeKey;
  onRangeChange: (range: StatsRangeKey) => void;
  stats: StatsSummary;
}) {
  const first = stats.timeline[0]?.bucket;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedControl
        size="md"
        value={range}
        onChange={onRangeChange}
        options={STATS_RANGES.map((r) => ({ key: r.key, label: r.label }))}
      />
      {first != null && (
        <span className="text-text-muted flex items-center gap-1.5 text-xs">
          <CalendarDays className="h-3.5 w-3.5" />
          {new Date(first).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {" – "}
          Today
        </span>
      )}
    </div>
  );
}

function SeriesLegend({ series, theme }: { series: ModelSeries[]; theme: ChartTheme }) {
  return (
    <Legend
      items={series.map((s) => ({ key: s.key, name: s.name, color: seriesColor(theme, s.key) }))}
    />
  );
}

function timelineTable(
  stats: StatsSummary,
  series: ModelSeries[],
  metric: "images" | "spend"
): ChartTable {
  const fmt = metric === "spend" ? formatMoney : formatCount;
  return {
    columns: ["Period", ...series.map((s) => s.name), "Total"],
    rows: stats.timeline
      .filter((p) => p.images > 0)
      .map((p) => [
        formatBucket(p.bucket, stats.granularity, true),
        ...series.map((s) => fmt(p[`${metric}_${s.key}`] as number)),
        fmt(p[metric]),
      ]),
  };
}

/** Top models get their own slice (in their stable series color); the tail folds into Other. */
function donutSlices(stats: StatsSummary, theme: ChartTheme): DonutSlice[] {
  const slices: DonutSlice[] = [];
  let other = 0;
  for (const model of stats.models) {
    if (model.seriesKey !== OTHER_SERIES_KEY && slices.length < MAX_DONUT_SLICES - 1) {
      slices.push({
        key: model.modelId,
        name: model.name,
        value: model.images,
        color: seriesColor(theme, model.seriesKey),
      });
    } else {
      other += model.images;
    }
  }
  if (other > 0) {
    slices.push({ key: OTHER_SERIES_KEY, name: "Other models", value: other, color: theme.other });
  }
  return slices;
}

function SubjectCard({
  title,
  entries,
  names,
  fallback,
  withCount,
  total,
  color,
  emptyText,
}: {
  title: string;
  entries: CountEntry[];
  names: Map<string, string>;
  fallback: string;
  withCount: number;
  total: number;
  color: string;
  emptyText: string;
}) {
  return (
    <ChartCard
      title={title}
      subtitle={`Used in ${formatPercent(withCount, total)} of images`}
      table={{
        columns: [title.replace(/s$/, ""), "Images", "Spend"],
        rows: entries.map((e) => [names.get(e.key) ?? fallback, e.count, formatMoney(e.spend)]),
      }}
    >
      {entries.length === 0 ? (
        <EmptyChart>{emptyText}</EmptyChart>
      ) : (
        <BarList
          initialVisible={6}
          items={entries.map((e) => ({
            key: e.key,
            label: names.get(e.key) ?? <span className="text-text-muted italic">{fallback}</span>,
            value: e.count,
            display: formatCount(e.count),
            detail: e.spend > 0 ? formatMoney(e.spend) : undefined,
            color,
          }))}
        />
      )}
    </ChartCard>
  );
}

function RatioGlyph({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h)
    return (
      <span className="border-text-muted h-3 w-3 shrink-0 rounded-[2px] border border-dashed" />
    );
  const scale = 12 / Math.max(w, h);
  return (
    <span
      className="border-text-tertiary shrink-0 rounded-[2px] border"
      style={{ width: Math.max(4, w * scale), height: Math.max(4, h * scale) }}
    />
  );
}

function FunFacts({ stats }: { stats: StatsSummary }) {
  const { totals } = stats;
  const facts: Array<{ icon: LucideIcon; label: string; value: ReactNode; hint?: string }> = [
    {
      icon: Flame,
      label: "Longest streak",
      value: `${totals.longestStreak} day${totals.longestStreak === 1 ? "" : "s"}`,
      hint: totals.currentStreak > 1 ? `${totals.currentStreak} days and counting` : undefined,
    },
    {
      icon: Sparkles,
      label: "Busiest day",
      value: totals.busiestDay ? `${formatCount(totals.busiestDay.count)} images` : "—",
      hint: totals.busiestDay
        ? new Date(totals.busiestDay.day).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : undefined,
    },
    {
      icon: Images,
      label: "Pixels generated",
      value:
        totals.megapixels >= 1000
          ? `${(totals.megapixels / 1000).toFixed(1)} GP`
          : `${Math.round(totals.megapixels).toLocaleString()} MP`,
    },
    {
      icon: ImagePlus,
      label: "Used references",
      value: formatPercent(totals.withReferences, totals.images),
      hint: `${totals.avgReferences.toFixed(1)} refs per image`,
    },
    {
      icon: Wand2,
      label: "Edits",
      value: formatCount(totals.edits),
      hint: totals.upscales > 0 ? `+ ${formatCount(totals.upscales)} upscales` : undefined,
    },
    {
      icon: Shuffle,
      label: "From variations",
      value: formatPercent(totals.variations, totals.images),
      hint: `${formatCount(totals.variations)} images`,
    },
    {
      icon: Type,
      label: "Avg prompt",
      value: `${Math.round(totals.avgPromptWords)} words`,
    },
    {
      icon: Boxes,
      label: "Models tried",
      value: formatCount(totals.models),
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
      {facts.map(({ icon: Icon, label, value, hint }) => (
        <div key={label} className="flex min-w-0 gap-2.5">
          <div className="bg-surface-overlay/70 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            <Icon className="text-text-tertiary h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <dt className="text-text-muted text-[11px]">{label}</dt>
            <dd className="text-text-primary truncate text-sm font-semibold">{value}</dd>
            {hint && <dd className="text-text-muted truncate text-[11px]">{hint}</dd>}
          </div>
        </div>
      ))}
    </dl>
  );
}

function WordCloud({ words }: { words: Array<{ word: string; count: number }> }) {
  if (words.length === 0) {
    return <EmptyChart>Not enough repeated words yet.</EmptyChart>;
  }
  const max = words[0].count;
  const min = words[words.length - 1].count;
  return (
    <ul className="flex flex-wrap items-baseline gap-x-2 gap-y-2">
      {words.map(({ word, count }) => {
        const t = max === min ? 1 : (count - min) / (max - min);
        return (
          <li
            key={word}
            title={`${word}: ${count} prompts`}
            className="bg-surface-overlay/60 border-c-border/50 hover:border-c-border flex items-baseline gap-1.5 rounded-full border px-2.5 py-1 transition-colors"
          >
            <span
              className="text-text-secondary"
              style={{ fontSize: `${12 + t * 6}px`, fontWeight: t > 0.5 ? 600 : 500 }}
            >
              {word}
            </span>
            <span className="text-text-muted text-[10px] tabular-nums">{count}</span>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyStatsState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="bg-surface-raised mb-4 flex h-16 w-16 items-center justify-center rounded-full">
        <BarChart3 className="text-text-muted h-8 w-8" />
      </div>
      <h3 className="text-text-secondary mb-2 text-lg font-medium">No images yet</h3>
      <p className="text-text-muted max-w-sm text-sm">
        Generate a few images and Prismix will chart your spending, model habits, and more.
      </p>
    </div>
  );
}
