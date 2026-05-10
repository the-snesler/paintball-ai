import { Combobox } from "@base-ui/react/combobox";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import SVG from "react-inlinesvg";
import SearchComboboxPopup from "~/components/ui/SearchComboboxPopup";
import { useSearchCombobox } from "~/hooks/useSearchCombobox";
import { inferIcon } from "~/lib/modelNames";
import { getProvider, listProviders } from "~/lib/providers";
import type { SearchResult } from "~/lib/providers";
import { testTextModel } from "~/lib/textModel";
import { useSettingsStore } from "~/stores/settingsStore";
import type { ApiKeyProvider } from "~/types";

export default function AddCustomTextModelButton() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const textModels = useSettingsStore((s) => s.textModels);
  const addCustomTextModel = useSettingsStore((s) => s.addCustomTextModel);

  // Providers that can run a text model at all — whether or not they offer search.
  const availableProviders = useMemo(
    () =>
      listProviders().filter(
        (p) => p.capabilities.text && p.id !== "debug" && apiKeys[p.id as ApiKeyProvider]
      ),
    [apiKeys]
  );
  const disabled = availableProviders.length === 0;
  const defaultProvider = (availableProviders[0]?.id as ApiKeyProvider) ?? "google";

  const [isAdding, setIsAdding] = useState(false);
  const [provider, setProvider] = useState<ApiKeyProvider>(defaultProvider);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const apiKey = apiKeys[provider];
  const canSearch = getProvider(provider).capabilities.searchText;

  const {
    inputValue: modelId,
    setInputValue: setModelId,
    open,
    setOpen,
    suggestions,
    isSearching,
    resetSearch,
  } = useSearchCombobox<SearchResult>({
    enabled: canSearch && !!apiKey && !loading,
    search: async (query) => {
      const search = getProvider(provider).searchTextModels;
      return search ? search(query, apiKey!) : [];
    },
  });

  useEffect(() => {
    if (!isAdding) {
      return;
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isAdding]);

  const reset = () => {
    setIsAdding(false);
    setModelId("");
    setError(null);
    setStatus("");
    setProvider(defaultProvider);
    resetSearch();
  };

  const handleAdd = async (altModelID?: string) => {
    const trimmed = (altModelID ?? modelId).trim();
    if (!trimmed) return;
    setOpen(false);

    if (provider === "replicate" && !trimmed.includes("/")) {
      setError("Replicate model IDs look like 'owner/model-name'");
      return;
    }

    const id = `${provider}:${trimmed}`;
    if (textModels.some((m) => m.id === id)) {
      setError("Model already added");
      return;
    }

    if (!apiKey) {
      setError(`Add a ${provider === "google" ? "Google" : "Replicate"} API key first`);
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("Testing model...");

    try {
      await testTextModel(provider, apiKey, trimmed);
      const hit = suggestions.find((s) => s.id === trimmed);
      const name = hit?.name || trimmed;
      const icon = hit?.icon || (provider === "google" ? "/icons/google.svg" : inferIcon(trimmed));
      addCustomTextModel(provider, trimmed, name, icon);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach model");
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => {
          if (availableProviders.length > 0) {
            setProvider(availableProviders[0].id as ApiKeyProvider);
          }
          setIsAdding(true);
        }}
        disabled={disabled}
        className={`border-c-border text-text-tertiary flex w-full items-center gap-2 rounded-lg border border-dashed p-2.5 transition-colors ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:border-c-border hover:text-text-secondary"
        }`}
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Add custom text model</span>
      </button>
    );
  }

  const placeholder = provider === "google" ? "gemini-3-flash-preview" : "owner/model-name";

  return (
    <div className="border-c-border bg-surface-overlay/50 space-y-2 rounded-lg border p-3">
      {availableProviders.length > 1 && (
        <div className="space-y-1">
          <label className="text-text-secondary block text-xs font-medium">Provider</label>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as ApiKeyProvider);
              setError(null);
              resetSearch();
            }}
            className="border-c-border bg-surface-raised text-text-primary w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          >
            {availableProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-text-secondary block text-xs font-medium">Model ID</label>
        {canSearch ? (
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
                className="border-c-border bg-surface-raised text-text-primary placeholder-text-muted w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !open && !loading) handleAdd();
                }}
                ref={inputRef}
              />
              {isSearching && (
                <Loader2 className="text-text-muted absolute top-2.5 right-2.5 h-4 w-4 animate-spin" />
              )}
            </div>
            <SearchComboboxPopup
              suggestions={suggestions}
              isSearching={isSearching}
              showEmptyState={modelId.trim().length >= 2}
              emptyStateText="No text models found"
              getKey={(result) => result.id}
              getValue={(result) => result.id}
              renderItem={(result) => {
                const icon = result.icon || inferIcon(result.id);
                return (
                  <>
                    {icon ? (
                      <SVG src={icon} className="h-5 w-5 shrink-0" />
                    ) : (
                      <div className="bg-surface-interactive h-5 w-5 shrink-0 rounded" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-text-primary truncate text-sm font-medium">
                        {result.name}
                      </p>
                      {result.description && (
                        <p className="text-text-tertiary truncate text-xs">{result.description}</p>
                      )}
                    </div>
                  </>
                );
              }}
            />
          </Combobox.Root>
        ) : (
          <input
            type="text"
            value={modelId}
            onChange={(e) => {
              setModelId(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !loading) handleAdd();
            }}
            placeholder={placeholder}
            className="border-c-border bg-surface-raised text-text-primary placeholder-text-muted w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
            ref={inputRef}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleAdd()}
          disabled={loading || !modelId.trim()}
          className="disabled:bg-surface-interactive disabled:text-text-muted flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
        <button
          onClick={reset}
          className="bg-surface-interactive text-text-secondary hover:bg-c-border rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-text-muted text-xs">
        {status || "A quick test generation runs before saving to verify the model works."}
      </p>
    </div>
  );
}
