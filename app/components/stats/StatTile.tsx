import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Fractional change vs the previous period (0.12 = +12%). */
  delta?: { value: number; period: string } | null;
  trend?: number[];
  trendColor?: string;
  hero?: boolean;
  className?: string;
}

export function StatTile({
  label,
  value,
  hint,
  delta,
  trend,
  trendColor,
  hero = false,
  className,
}: StatTileProps) {
  const showTrend = trend && trend.length > 1 && trend.some((v) => v > 0);

  return (
    <div
      className={clsx(
        "border-c-border/70 bg-surface-raised relative flex min-w-0 flex-col overflow-hidden rounded-xl border p-4",
        className
      )}
    >
      <p className="text-text-tertiary text-xs">{label}</p>
      <p
        className={clsx(
          "text-text-primary mt-1 font-semibold tracking-tight",
          hero ? "text-4xl md:text-5xl" : "text-2xl"
        )}
      >
        {value}
      </p>
      <div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-2 text-xs">
        {delta && Number.isFinite(delta.value) && (
          <span className="text-text-secondary inline-flex items-center gap-0.5 font-medium">
            {delta.value >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {Math.abs(Math.round(delta.value * 100))}%
            <span className="text-text-muted font-normal">vs prev {delta.period}</span>
          </span>
        )}
        {hint && <span className="text-text-muted">{hint}</span>}
      </div>
      {showTrend && (
        <div className={clsx("-mx-4 mt-auto -mb-4 pt-3", hero ? "h-20" : "h-12")}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={trend.map((v, i) => ({ i, v }))}
              margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
            >
              <Area
                type="monotone"
                dataKey="v"
                stroke={trendColor}
                strokeWidth={2}
                fill={trendColor}
                fillOpacity={0.1}
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
