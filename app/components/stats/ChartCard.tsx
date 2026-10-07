import clsx from "clsx";
import { BarChart3, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";

export interface ChartTable {
  columns: string[];
  rows: Array<Array<string | number>>;
}

interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  legend?: ReactNode;
  /** Accessible table twin of the chart; adds a chart/table toggle to the header. */
  table?: ChartTable;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  actions,
  legend,
  table,
  className,
  children,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section
      className={clsx(
        "border-c-border/70 bg-surface-raised flex min-w-0 flex-col rounded-xl border p-4 md:p-5",
        className
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-text-primary text-sm font-medium">{title}</h2>
          {subtitle && <p className="text-text-muted mt-0.5 text-xs">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="text-text-muted hover:text-text-secondary hover:bg-surface-overlay rounded-md p-1.5 transition-colors"
              aria-label={showTable ? "Show chart" : "Show table"}
              title={showTable ? "Show chart" : "Show table"}
            >
              {showTable ? (
                <BarChart3 className="h-3.5 w-3.5" />
              ) : (
                <Table2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </header>
      {showTable && table ? (
        <DataTable table={table} />
      ) : (
        <>
          {legend && <div className="mb-3">{legend}</div>}
          <div className="min-w-0 flex-1">{children}</div>
        </>
      )}
    </section>
  );
}

function DataTable({ table }: { table: ChartTable }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="bg-surface-raised sticky top-0">
          <tr className="border-c-border border-b">
            {table.columns.map((column, i) => (
              <th
                key={column}
                className={clsx("text-text-muted px-2 py-1.5 font-medium", i > 0 && "text-right")}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r} className="border-border-subtle border-b last:border-b-0">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={clsx(
                    "px-2 py-1.5",
                    i === 0 ? "text-text-secondary" : "text-text-tertiary text-right tabular-nums"
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Legend({
  items,
  shape = "rect",
}: {
  items: Array<{ key: string; name: string; color: string }>;
  shape?: "rect" | "line";
}) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.key} className="text-text-tertiary flex items-center gap-1.5 text-xs">
          <span
            className={clsx(
              "shrink-0",
              shape === "rect" ? "h-2.5 w-2.5 rounded-[3px]" : "h-0.5 w-3 rounded-full"
            )}
            style={{ backgroundColor: item.color }}
          />
          <span className="max-w-40 truncate">{item.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = "sm",
}: {
  value: T;
  options: Array<{ key: T; label: string }>;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      className="border-c-border/70 bg-surface inline-flex items-center rounded-lg border p-0.5"
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.key)}
            className={clsx(
              "rounded-md font-medium transition-colors",
              size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
              selected
                ? "bg-surface-overlay text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex h-full min-h-32 items-center justify-center text-center text-xs">
      {children}
    </div>
  );
}
