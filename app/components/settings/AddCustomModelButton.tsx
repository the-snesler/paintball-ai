import { Plus, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { inferIcon } from "~/lib/modelNames";
import { getProvider } from "~/lib/providers";
import type { SearchResult } from "~/lib/providers";
import SVG from "react-inlinesvg";
import { useSettingsStore } from "~/stores/settingsStore";
import { Combobox } from "@base-ui/react/combobox";

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
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const addCustomModel = useSettingsStore((s) => s.addCustomModel);
  const models = useSettingsStore((s) => s.models);

  useEffect(() => {
    if (!modelId.trim() || modelId.length < 2 || !apiKey || loading) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const search = getProvider("replicate").searchImageModels;
        const results = search ? await search(modelId, apiKey) : [];
        setSuggestions(results);
        setOpen(results.length > 0);
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
    setOpen(false);

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
      const resolve = getProvider("replicate").resolveImageModel;
      if (!resolve) throw new Error("Replicate provider can't resolve models");
      const { name, capabilities, schemaMapping, icon } = await resolve(
        idToAdd,
        apiKey!,
        setLoadingStatus
      );

      addCustomModel("replicate", idToAdd, name, capabilities, schemaMapping, icon);
      setModelId("");
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch model");
    } finally {
      setLoading(false);
      setLoadingStatus("");
    }
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

  return (
    <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
      <Combobox.Root
        open={open}
        onOpenChange={setOpen}
        inputValue={modelId}
        onInputValueChange={(val) => {
          setModelId(val);
          setError(null);
        }}
        onValueChange={(id) => {
          if (id && !loading) handleAdd(id as string);
        }}
        filter={null}
      >
        <div className="relative">
          <Combobox.Input
            placeholder="Type to search..."
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !open && !loading) handleAdd();
            }}
            autoFocus
          />
          {isSearching && (
            <Loader2 className="absolute top-2.5 right-2.5 h-4 w-4 animate-spin text-zinc-500" />
          )}
        </div>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} align="start">
            <Combobox.Popup
              className="z-50 max-h-72 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
              style={{ width: "var(--anchor-width)" }}
            >
              {suggestions.map((result) => {
                const icon = inferIcon(result.id);
                const owner = result.id.split("/")[0];
                return (
                  <Combobox.Item
                    key={result.id}
                    value={result.id}
                    className="flex w-full cursor-default items-center gap-2.5 px-3 py-2 text-left outline-none data-[highlighted]:bg-zinc-800"
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
                  </Combobox.Item>
                );
              })}
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleAdd()}
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
            setOpen(false);
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
