import { useState, type ReactNode } from "react";

export interface BarListItem {
  key: string;
  label: ReactNode;
  value: number;
  /** Primary value label at the bar tip. */
  display: string;
  /** Secondary detail shown muted after the value. */
  detail?: string;
  color: string;
  icon?: ReactNode;
}

/** Horizontal bars on a shared scale with direct value labels — readable without hover. */
export function BarList({
  items,
  initialVisible = 8,
}: {
  items: BarListItem[];
  initialVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(0, ...items.map((item) => item.value));
  const visible = expanded ? items : items.slice(0, initialVisible);
  const hidden = items.length - visible.length;

  return (
    <div>
      <ul className="space-y-2.5">
        {visible.map((item) => (
          <li key={item.key} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="text-text-secondary flex min-w-0 items-center gap-1.5">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="text-text-primary font-medium">{item.display}</span>
                {item.detail && <span className="text-text-muted"> · {item.detail}</span>}
              </span>
            </div>
            <div className="bg-surface-overlay/60 h-2 w-full overflow-hidden rounded-r-[4px]">
              <div
                className="h-full rounded-r-[4px] transition-[width,filter] duration-500 ease-out group-hover:brightness-110"
                style={{
                  width: `${max > 0 ? Math.max((item.value / max) * 100, item.value > 0 ? 1.5 : 0) : 0}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {(hidden > 0 || expanded) && items.length > initialVisible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-text-muted hover:text-text-secondary mt-3 text-xs transition-colors"
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}
