import type { TimingSummary } from "~/lib/stats";
import { formatDuration } from "./format";

export interface TimingRow {
  key: string;
  name: string;
  color: string;
  timing: TimingSummary;
}

/**
 * Range dot plot: whisker = fastest → p90, band = middle 50%, dot = median.
 * Every row shares one scale so models compare directly.
 */
export function TimingChart({ rows, surface }: { rows: TimingRow[]; surface: string }) {
  const max = niceCeil(Math.max(1000, ...rows.map((r) => r.timing.p90)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const pct = (ms: number) => `${Math.min(100, (ms / max) * 100)}%`;

  return (
    <div>
      <ul className="space-y-3">
        {rows.map(({ key, name, color, timing }) => (
          <li
            key={key}
            className="group"
            title={`${name}\nMedian ${formatDuration(timing.median)} · middle 50% ${formatDuration(timing.p25)}–${formatDuration(timing.p75)} · p90 ${formatDuration(timing.p90)} · fastest ${formatDuration(timing.min)} · n=${timing.n}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="text-text-secondary truncate">{name}</span>
              <span className="shrink-0 tabular-nums">
                <span className="text-text-primary font-medium">
                  {formatDuration(timing.median)}
                </span>
                <span className="text-text-muted"> · p90 {formatDuration(timing.p90)}</span>
              </span>
            </div>
            <div className="relative h-3">
              {/* Track gridlines */}
              {ticks.slice(1, -1).map((t) => (
                <span
                  key={t}
                  className="bg-border-subtle absolute top-0 h-full w-px"
                  style={{ left: pct(t) }}
                />
              ))}
              {/* Whisker: fastest → p90 */}
              <span
                className="bg-text-muted/50 absolute top-1/2 h-px -translate-y-1/2"
                style={{
                  left: pct(timing.min),
                  width: `calc(${pct(timing.p90)} - ${pct(timing.min)})`,
                }}
              />
              {/* Middle 50% */}
              <span
                className="absolute top-1/2 h-2 -translate-y-1/2 rounded-[4px] opacity-35 transition-opacity group-hover:opacity-55"
                style={{
                  left: pct(timing.p25),
                  width: `max(4px, calc(${pct(timing.p75)} - ${pct(timing.p25)}))`,
                  backgroundColor: color,
                }}
              />
              {/* Median */}
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: pct(timing.median),
                  backgroundColor: color,
                  boxShadow: `0 0 0 2px ${surface}`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="border-c-border/70 text-text-muted relative mt-3 h-4 border-t text-[10px] tabular-nums">
        {ticks.map((t, i) => (
          <span
            key={t}
            className="absolute top-1"
            style={{
              left: pct(t),
              transform:
                i === 0
                  ? "none"
                  : i === ticks.length - 1
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            {t === 0 ? "0s" : formatDuration(t)}
          </span>
        ))}
      </div>
      <p className="text-text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="bg-text-tertiary h-2 w-2 rounded-full" /> median
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-text-tertiary/40 h-2 w-3 rounded-[3px]" /> middle 50%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-text-muted/60 h-px w-3" /> fastest → p90
        </span>
      </p>
    </div>
  );
}

/** Round up to a clean tick-friendly ceiling (in ms). */
function niceCeil(ms: number): number {
  const steps = [5, 10, 15, 20, 30, 40, 60, 90, 120, 180, 240, 300, 600, 900, 1200];
  const seconds = ms / 1000;
  const step = steps.find((s) => s >= seconds) ?? Math.ceil(seconds / 600) * 600;
  return step * 1000;
}
