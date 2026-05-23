import { Search, Star, X } from "lucide-react";
import { useSettingsStore } from "~/stores/settingsStore";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  showFavoritesOnly?: boolean;
  onToggleFavorites?: () => void;
}

export function SearchBar({
  value,
  onChange,
  showFavoritesOnly = false,
  onToggleFavorites,
}: SearchBarProps) {
  const semanticSearchEnabled = useSettingsStore((s) => s.semanticSearchEnabled);
  const placeholder = semanticSearchEnabled
    ? "Search prompts and image content..."
    : "Search prompts...";
  const clearButtonOffset = onToggleFavorites ? "right-8" : "right-1.5";

  return (
    <div className="relative flex items-center">
      <Search className="text-text-muted pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`border-c-border bg-surface-raised text-text-primary placeholder-text-muted h-8 w-full rounded-lg border py-1.5 text-sm transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none ${
          onToggleFavorites
            ? value
              ? "pr-14 pl-8"
              : "pr-9 pl-8"
            : value
              ? "pr-7 pl-8"
              : "pr-3 pl-8"
        }`}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={`text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary absolute top-1/2 ${clearButtonOffset} flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded transition-colors`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {onToggleFavorites && (
        <button
          onClick={onToggleFavorites}
          aria-label={showFavoritesOnly ? "Showing favorites only" : "Show favorites only"}
          title={showFavoritesOnly ? "Showing favorites only" : "Show favorites only"}
          className={`absolute top-1/2 right-1.5 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded transition-colors ${
            showFavoritesOnly
              ? "bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/20"
              : "text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary"
          }`}
        >
          <Star className={`h-3.5 w-3.5 ${showFavoritesOnly ? "fill-current" : ""}`} />
        </button>
      )}
    </div>
  );
}
