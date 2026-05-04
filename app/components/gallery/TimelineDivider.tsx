import { Tooltip } from "../ui/Tooltip";

interface TimelineDividerProps {
  dateLabel: string;
  outputCount: number;
  prompt: string;
}

export function TimelineDivider({ dateLabel, outputCount, prompt }: TimelineDividerProps) {
  return (
    <div className="not-group-first:mt-5">
      <p className="text-text-muted text-xs font-medium">
        {`${dateLabel} · ${outputCount} ${outputCount === 1 ? "output" : "outputs"}`}
      </p>
      <Tooltip content={prompt}>
        <p className="text text-text-secondary mt-1 truncate text-sm">{prompt}</p>
      </Tooltip>
    </div>
  );
}
