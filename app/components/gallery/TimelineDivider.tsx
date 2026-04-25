interface TimelineDividerProps {
  dateLabel: string;
  outputCount: number;
  prompt: string;
}

export function TimelineDivider({ dateLabel, outputCount, prompt }: TimelineDividerProps) {
  return (
    <div className="mb-3 not-group-first:mt-10">
      <div className="flex items-center gap-2 font-medium text-text-muted">
        <span>{dateLabel}</span>
        <span>·</span>
        <span className="text-xs">
          {outputCount} {outputCount === 1 ? "output" : "outputs"}
        </span>
      </div>
      <p className="text mt-1 text-text-secondary">{prompt}</p>
    </div>
  );
}
