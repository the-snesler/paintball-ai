import { useSyncExternalStore } from "react";
import { OTHER_SERIES_KEY } from "~/lib/stats";

/**
 * Categorical palette validated (CVD + normal-vision separation, contrast) against the
 * card surfaces: light #ffffff/#f4f4f5, dark #18181b. Order is part of the CVD safety —
 * don't reorder or append hues; fold extra series into "Other" instead.
 */
const LIGHT = {
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  other: "#a1a1aa",
  sequential: "#2a78d6",
  grid: "#e4e4e7",
  axis: "#d4d4d8",
  tick: "#71717a",
  surface: "#f4f4f5",
  cursor: "rgba(9, 9, 11, 0.05)",
};

const DARK: ChartTheme = {
  series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  other: "#52525b",
  sequential: "#3987e5",
  grid: "#27272a",
  axis: "#3f3f46",
  tick: "#71717a",
  surface: "#18181b",
  cursor: "rgba(255, 255, 255, 0.04)",
};

export type ChartTheme = typeof LIGHT;

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useChartTheme(): ChartTheme {
  const isDark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true
  );
  return isDark ? DARK : LIGHT;
}

export function seriesColor(theme: ChartTheme, seriesKey: string): string {
  if (seriesKey === OTHER_SERIES_KEY) return theme.other;
  const slot = Number(seriesKey.slice(1));
  return theme.series[slot] ?? theme.other;
}
