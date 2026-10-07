import clsx from "clsx";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatCount, formatPercent } from "./format";

export interface DonutSlice {
  key: string;
  name: string;
  value: number;
  color: string;
}

/** Part-to-whole donut with a center readout and a side legend that doubles as hover target. */
export function ShareDonut({
  slices,
  centerLabel,
  surface,
}: {
  slices: DonutSlice[];
  centerLabel: string;
  surface: string;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const active = slices.find((s) => s.key === activeKey) ?? null;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              paddingAngle={slices.length > 1 ? 1.5 : 0}
              cornerRadius={4}
              stroke={surface}
              strokeWidth={2}
              animationDuration={500}
              onMouseLeave={() => setActiveKey(null)}
            >
              {slices.map((slice) => (
                <Cell
                  key={slice.key}
                  fill={slice.color}
                  opacity={activeKey && activeKey !== slice.key ? 0.35 : 1}
                  onMouseEnter={() => setActiveKey(slice.key)}
                  style={{ transition: "opacity 150ms", outline: "none" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-text-primary text-2xl font-semibold">
            {active ? formatPercent(active.value, total) : formatCount(total)}
          </span>
          <span className="text-text-muted max-w-24 truncate text-[11px]">
            {active ? active.name : centerLabel}
          </span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {slices.map((slice) => (
          <li
            key={slice.key}
            onMouseEnter={() => setActiveKey(slice.key)}
            onMouseLeave={() => setActiveKey(null)}
            className={clsx(
              "flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors",
              activeKey === slice.key && "bg-surface-overlay/70"
            )}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-text-secondary min-w-0 flex-1 truncate">{slice.name}</span>
            <span className="text-text-muted tabular-nums">{formatCount(slice.value)}</span>
            <span className="text-text-primary w-9 text-right font-medium tabular-nums">
              {formatPercent(slice.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
