import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search prompts..."
        className={`h-8 w-full rounded-lg border border-c-border bg-surface-raised py-1.5 text-sm text-text-primary placeholder-text-muted transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none ${value ? "pr-7 pl-8" : "pr-3 pl-8"}`}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-overlay hover:text-text-secondary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
