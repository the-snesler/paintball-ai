import { Plus, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  inferIcon,
  inferName,
  resolveModelCapabilities,
  searchReplicateModels,
  type ReplicateSearchResult,
} from "~/lib/replicateSchema";
import SVG from "react-inlinesvg";
import { useSettingsStore } from "~/stores/settingsStore";

export default function AddCustomModelButton({
  disabled,
  apiKey,
}: {
  disabled?: boolean;
  apiKey: string | null;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [modelId, setModelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ReplicateSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addCustomModel = useSettingsStore((s) => s.addCustomModel);
  const models = useSettingsStore((s) => s.models);

  useEffect(() => {
    if (!modelId.trim() || modelId.length < 2 || !apiKey || loading) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchReplicateModels(modelId, apiKey);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        // suggestions are best-effort
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [modelId, apiKey]);

  const handleAdd = async (altModelID?: string) => {
    const idToAdd = altModelID ?? modelId;
    if (!idToAdd.trim()) return;
    setShowSuggestions(false);

    if (!idToAdd.includes("/")) {
      setError("Format: owner/model-name");
      return;
    }

    const fullId = `replicate/${idToAdd}`;
    if (models.some((m) => m.id === fullId)) {
      setError("Model already added");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { name, capabilities, schemaMapping, icon } = await resolveModelCapabilities(
        idToAdd,
        apiKey!,
        setLoadingStatus
      );

      addCustomModel(idToAdd, name, capabilities, schemaMapping, icon);
      setModelId("");
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch model");
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
  };

  const handleSelectSuggestion = (result: ReplicateSearchResult) => {
    setModelId(result.id);
    setShowSuggestions(false);
    setError(null);
    handleAdd(result.id);
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 150);
  };

  const handleSuggestionMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // prevent input blur before click fires
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        disabled={disabled}
        className={`flex w-full items-center gap-2 rounded-lg border border-dashed border-zinc-700 p-2.5 text-zinc-400 transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-zinc-600 hover:text-zinc-300"
        }`}
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Add custom Replicate model</span>
      </button>
    );
  }
  // TODO: this is a combobox, and we have floating-ui installed, but instead we have shipped the world's least accessible dropdown. We should fix this at some point.
  return (
    <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
      <div className="relative">
        <input
          type="text"
          value={modelId}
          onChange={(e) => {
            setModelId(e.target.value);
            setError(null);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          onBlur={handleBlur}
          placeholder="Type to search..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          autoFocus
        />
        {isSearching && (
          <Loader2 className="absolute top-2.5 right-2.5 h-4 w-4 animate-spin text-zinc-500" />
        )}
        {showSuggestions && suggestions.length > 0 && (
          <ul
            onMouseDown={handleSuggestionMouseDown}
            className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
          >
            {suggestions.map((result) => {
              const icon = inferIcon(result.id);
              const owner = result.id.split("/")[0];
              return (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectSuggestion(result)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-800"
                  >
                    {icon ? (
                      <SVG src={icon} className="h-5 w-5 shrink-0" />
                    ) : (
                      <div className="h-5 w-5 shrink-0 rounded bg-zinc-700" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <p className="truncate text-sm font-medium text-zinc-100">{result.name}</p>
                        <p className="shrink-0 text-xs text-zinc-500">{owner}</p>
                      </div>
                      {result.description && (
                        <p className="truncate text-xs text-zinc-400">{result.description}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleAdd}
          disabled={loading || !modelId.trim()}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
        <button
          onClick={() => {
            setIsAdding(false);
            setModelId("");
            setError(null);
            setSuggestions([]);
            setShowSuggestions(false);
          }}
          className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-600"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-zinc-500">
        {loadingStatus || 'Type to search, or enter a Replicate model ID like "stability-ai/sdxl".'}
      </p>
    </div>
  );
}
