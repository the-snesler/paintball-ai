import { Combobox } from "@base-ui/react/combobox";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import SVG from "react-inlinesvg";
import SearchComboboxPopup from "~/components/ui/SearchComboboxPopup";
import { useSearchCombobox } from "~/hooks/useSearchCombobox";
import { inferIcon, inferName } from "~/lib/modelNames";
import { getProvider, providersWith } from "~/lib/providers";
import type { SearchResult } from "~/lib/providers";
import { useSettingsStore } from "~/stores/settingsStore";
import type { ApiKeyProvider } from "~/types";

export default function AddCustomUpscalerButton() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const addCustomUpscaler = useSettingsStore((s) => s.addCustomUpscaler);
  const upscalers = useSettingsStore((s) => s.upscalers);

  const availableProviders = useMemo(
    () =>
      providersWith("searchUpscale").filter(
        (p) => p.id !== "debug" && apiKeys[p.id as ApiKeyProvider]
      ),
    [apiKeys]
  );
  const disabled = availableProviders.length === 0;
  const defaultProvider = (availableProviders[0]?.id as ApiKeyProvider) ?? "replicate";

  const [isAdding, setIsAdding] = useState(false);
  const [providerId, setProviderId] = useState<ApiKeyProvider>(defaultProvider);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const apiKey = apiKeys[providerId];
  const canSearch = !!getProvider(providerId).searchUpscalers;

  const { inputValue, setInputValue, open, setOpen, suggestions, isSearching, resetSearch } =
    useSearchCombobox<SearchResult>({
      enabled: !!apiKey && !loading && canSearch,
      search: async (query) => {
        const search = getProvider(providerId).searchUpscalers;
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

  const handleAdd = async (altModelID?: string) => {
    const idToAdd = altModelID ?? inputValue;
    if (!idToAdd.trim()) return;
    setOpen(false);

    if (!idToAdd.includes("/")) {
      setError("Format: owner/model-name");
      return;
    }

    const syntheticId = `${providerId}/${idToAdd}`;
    if (upscalers.some((u) => u.id === syntheticId)) {
      setError("Upscaler already added");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const name = inferName(idToAdd);
      const icon = inferIcon(idToAdd);
      addCustomUpscaler(idToAdd, name, icon);
      setInputValue("");
      resetSearch();
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add upscaler");
    } finally {
      setLoading(false);
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
        className={`border-c-border text-text-tertiary flex w-full items-center gap-2 rounded-lg border border-dashed p-2.5 transition-colors ${
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:border-c-border hover:text-text-secondary"
        }`}
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Add custom upscaler</span>
      </button>
    );
  }

  return (
    <div className="border-c-border bg-surface-overlay/50 space-y-2 rounded-lg border p-3">
      {availableProviders.length > 1 && (
        <div className="space-y-1">
          <label className="text-text-secondary block text-xs font-medium">Provider</label>
          <select
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value as ApiKeyProvider);
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
      <Combobox.Root
        open={open}
        onOpenChange={setOpen}
        inputValue={inputValue}
        onInputValueChange={(val) => {
          setInputValue(val);
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
          showEmptyState={inputValue.trim().length >= 2}
          emptyStateText="No upscalers found"
          getKey={(result) => result.id}
          getValue={(result) => result.id}
          renderItem={(result) => {
            const icon = result.icon || inferIcon(result.id);
            const owner = result.id.split("/")[0];
            return (
              <>
                {icon ? (
                  <SVG src={icon} className="h-5 w-5 shrink-0" />
                ) : (
                  <div className="bg-surface-interactive h-5 w-5 shrink-0 rounded" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-text-primary truncate text-sm font-medium">{result.name}</p>
                    <p className="text-text-muted shrink-0 text-xs">{owner}</p>
                  </div>
                  {result.description && (
                    <p className="text-text-tertiary truncate text-xs">{result.description}</p>
                  )}
                </div>
              </>
            );
          }}
        />
      </Combobox.Root>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleAdd()}
          disabled={loading || !inputValue.trim()}
          className="disabled:bg-surface-interactive disabled:text-text-muted flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
        <button
          onClick={() => {
            setIsAdding(false);
            setInputValue("");
            setError(null);
            resetSearch();
          }}
          className="bg-surface-interactive text-text-secondary hover:bg-c-border rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-text-muted text-xs">
        Type to search, or enter a model ID like &quot;nightmareai/real-esrgan&quot;.
      </p>
    </div>
  );
}
