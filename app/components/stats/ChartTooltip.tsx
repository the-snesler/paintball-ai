import type { ReactNode } from "react";

export interface TooltipRow {
  key: string;
  name: string;
  value: string;
  color: string;
}

/** Shared tooltip chrome: values lead, series names follow, keyed by short line strokes. */
export function ChartTooltip({
  title,
  rows,
  footer,
}: {
  title: ReactNode;
  rows: TooltipRow[];
  footer?: ReactNode;
}) {
  return (
    <div className="border-c-border bg-surface-overlay/95 pointer-events-none min-w-40 rounded-lg border px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="text-text-muted mb-1.5 text-[11px] font-medium">{title}</p>
      {rows.length > 0 && (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-2 text-xs">
              <span
                className="h-0.5 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-text-primary font-semibold tabular-nums">{row.value}</span>
              <span className="text-text-tertiary max-w-44 truncate">{row.name}</span>
            </li>
          ))}
        </ul>
      )}
      {footer && (
        <div className="border-c-border/70 text-text-secondary mt-1.5 border-t pt-1.5 text-xs">
          {footer}
        </div>
      )}
    </div>
  );
}
