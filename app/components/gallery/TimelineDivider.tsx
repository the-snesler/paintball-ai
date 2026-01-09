interface TimelineDividerProps {
  label: string;
}

export function TimelineDivider({ label }: TimelineDividerProps) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="h-px flex-1 bg-zinc-800" />
      <span className="text-sm font-medium text-zinc-500">{label}</span>
      <div className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}
