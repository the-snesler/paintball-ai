import type { Granularity } from "~/lib/stats";

export function formatMoney(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 100) return `$${value.toFixed(2)}`;
  return `$${Math.round(value).toLocaleString()}`;
}

/** Compact axis labels: $0, $0.50, $12, $1.2K */
export function formatMoneyAxis(value: number): string {
  if (value === 0) return "$0";
  if (value >= 1000) return `$${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  if (value >= 10) return `$${Math.round(value)}`;
  return `$${value.toFixed(2).replace(/\.?0+$/, "")}`;
}

export function formatCount(value: number): string {
  if (value >= 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return value.toLocaleString();
}

export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 90) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

export function formatPercent(part: number, whole: number): string {
  if (whole === 0) return "0%";
  const pct = (part / whole) * 100;
  return pct > 0 && pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}

export function formatBucket(ts: number, granularity: Granularity, long = false): string {
  const date = new Date(ts);
  if (granularity === "month") {
    return date.toLocaleDateString(undefined, {
      month: "short",
      year: long ? "numeric" : "2-digit",
    });
  }
  const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return long && granularity === "week" ? `Week of ${label}` : label;
}
