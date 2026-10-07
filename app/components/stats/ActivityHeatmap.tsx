import clsx from "clsx";
import { Fragment, useState } from "react";
import { formatCount } from "./format";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

/** Day-of-week × hour grid on a single-hue ramp; zero cells recede into the track. */
export function ActivityHeatmap({
  grid,
  max,
  color,
}: {
  grid: number[][];
  max: number;
  color: string;
}) {
  const [hovered, setHovered] = useState<{ day: number; hour: number } | null>(null);

  const peak = (() => {
    let best = { day: 0, hour: 0, count: 0 };
    grid.forEach((row, day) =>
      row.forEach((count, hour) => {
        if (count > best.count) best = { day, hour, count };
      })
    );
    return best;
  })();

  const readout = hovered
    ? { ...hovered, count: grid[hovered.day][hovered.hour] }
    : peak.count > 0
      ? peak
      : null;

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[520px] gap-[3px]"
          style={{ gridTemplateColumns: "2rem repeat(24, minmax(0, 1fr))" }}
          onMouseLeave={() => setHovered(null)}
        >
          {grid.map((row, day) => (
            <Fragment key={day}>
              <span className="text-text-muted self-center pr-1 text-[10px]">{DAYS[day]}</span>
              {row.map((count, hour) => {
                const t = max > 0 ? count / max : 0;
                return (
                  <button
                    key={hour}
                    type="button"
                    aria-label={`${DAYS[day]} ${hourLabel(hour)}: ${count} images`}
                    onMouseEnter={() => setHovered({ day, hour })}
                    onFocus={() => setHovered({ day, hour })}
                    className={clsx(
                      "aspect-square rounded-[3px] outline outline-transparent transition-[outline-color]",
                      hovered?.day === day && hovered.hour === hour && "outline-text-tertiary"
                    )}
                    style={{
                      backgroundColor:
                        count === 0
                          ? "var(--surface-overlay)"
                          : `color-mix(in oklab, ${color} ${Math.round(18 + 82 * Math.sqrt(t))}%, var(--surface-overlay))`,
                    }}
                  />
                );
              })}
            </Fragment>
          ))}
          <span />
          {Array.from({ length: 24 }, (_, hour) => (
            <span key={hour} className="text-text-muted pt-1 text-center text-[10px]">
              {hour % 3 === 0 ? hourLabel(hour) : ""}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <p className="text-text-tertiary min-h-4">
          {readout && (
            <>
              <span className="text-text-primary font-semibold">{formatCount(readout.count)}</span>{" "}
              image{readout.count === 1 ? "" : "s"} on {DAYS[readout.day]}s at{" "}
              {hourLabel(readout.hour)}
              {!hovered && <span className="text-text-muted"> · your peak hour</span>}
            </>
          )}
        </p>
        <div className="text-text-muted flex items-center gap-1 text-[10px]">
          less
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <span
              key={t}
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{
                backgroundColor:
                  t === 0
                    ? "var(--surface-overlay)"
                    : `color-mix(in oklab, ${color} ${Math.round(18 + 82 * Math.sqrt(t))}%, var(--surface-overlay))`,
              }}
            />
          ))}
          more
        </div>
      </div>
    </div>
  );
}
