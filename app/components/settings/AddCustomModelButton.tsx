import { Combobox } from "@base-ui/react/combobox";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SVG from "react-inlinesvg";
import { inferIcon } from "~/lib/modelNames";
import { getProvider, providersWith } from "~/lib/providers";
import type { SearchResult } from "~/lib/providers";
import { useSettingsStore } from "~/stores/settingsStore";
import type { ApiKeyProvider, ModelCapabilities } from "~/types";

// Fallback capabilities used when a provider has no resolveImageModel step
// (e.g. Gemini image models — we infer from the current built-in Gemini shape).
const DEFAULT_IMAGE_CAPABILITIES: ModelCapabilities = {
  supportsAspectRatios: true,
  supportsResolution: true,
  supportsReferenceImages: true,
  maxReferenceImages: 10,
};

export default function AddCustomModelButton() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const addCustomModel = useSettingsStore((s) => s.addCustomModel);
  const models = useSettingsStore((s) => s.models);

  const availableProviders = useMemo(
    () =>
      providersWith("searchImage").filter(
        (p) => p.id !== "debug" && apiKeys[p.id as ApiKeyProvider]
      ),
    [apiKeys]
  );
  const disabled = availableProviders.length === 0;
  const defaultProvider = (availableProviders[0]?.id as ApiKeyProvider) ?? "replicate";

  const [isAdding, setIsAdding] = useState(false);
  const [providerId, setProviderId] = useState<ApiKeyProvider>(defaultProvider);
  const [modelId, setModelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const apiKey = apiKeys[providerId];

  useEffect(() => {
    if (!modelId.trim() || modelId.length < 2 || !apiKey || loading) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const search = getProvider(providerId).searchImageModels;
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
  }, [modelId, apiKey, providerId]);

  const handleAdd = async (altModelID?: string) => {
    const idToAdd = altModelID ?? modelId;
    if (!idToAdd.trim()) return;
    setOpen(false);

    if (providerId === "replicate" && !idToAdd.includes("/")) {
      setError("Format: owner/model-name");
      return;
    }

    const fullId = `${providerId}/${idToAdd}`;
    if (models.some((m) => m.id === fullId)) {
      setError("Model already added");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider(providerId);
      let name: string;
      let capabilities: ModelCapabilities;
      let schemaMapping;
      let icon: string | undefined;

      if (provider.resolveImageModel) {
        const resolved = await provider.resolveImageModel(idToAdd, apiKey!, setLoadingStatus);
        name = resolved.name;
        capabilities = resolved.capabilities;
        schemaMapping = resolved.schemaMapping;
        icon = resolved.icon;
      } else {
        // Providers without a resolve step (e.g. Google) — pick up name/icon from
        // the search result if we have one cached, otherwise fall back to the id.
        const hit = suggestions.find((s) => s.id === idToAdd);
        name = hit?.name || idToAdd;
        icon = hit?.icon || provider.iconPath;
        capabilities = DEFAULT_IMAGE_CAPABILITIES;
      }

      addCustomModel(providerId, idToAdd, name, capabilities, schemaMapping, icon);
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
        onClick={() => {
          if (availableProviders.length > 0) {
            setProviderId(availableProviders[0].id as ApiKeyProvider);
          }
          setIsAdding(true);
        }}
        disabled={disabled}
        className={`flex w-full items-center gap-2 rounded-lg border border-dashed border-zinc-700 p-2.5 text-zinc-400 transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-zinc-600 hover:text-zinc-300"
        }`}
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Add custom model</span>
      </button>
    );
  }

  const selectedProvider = getProvider(providerId);
  const placeholder =
    providerId === "replicate"
      ? 'Type to search, or enter e.g. "stability-ai/sdxl"'
      : "Type to search...";

  return (
    <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
      {availableProviders.length > 1 && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-zinc-300">Provider</label>
          <select
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value as ApiKeyProvider);
              setError(null);
              setSuggestions([]);
              setOpen(false);
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          >
            {availableProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}
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
            placeholder={placeholder}
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
                const icon = result.icon || inferIcon(result.id);
                const owner = result.id.includes("/") ? result.id.split("/")[0] : selectedProvider.label;
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
      <p className="text-xs text-zinc-500">{loadingStatus || placeholder}</p>
    </div>
  );
}
