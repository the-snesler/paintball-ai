import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import { testTextModel } from "~/lib/textModel";
import type { ApiKeyProvider } from "~/types";

export default function AddCustomTextModelButton() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const textModels = useSettingsStore((s) => s.textModels);
  const addCustomTextModel = useSettingsStore((s) => s.addCustomTextModel);

  const defaultProvider: ApiKeyProvider = apiKeys.google
    ? "google"
    : apiKeys.replicate
      ? "replicate"
      : "google";

  const [isAdding, setIsAdding] = useState(false);
  const [provider, setProvider] = useState<ApiKeyProvider>(defaultProvider);
  const [modelId, setModelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const disabled = !apiKeys.google && !apiKeys.replicate;

  const reset = () => {
    setIsAdding(false);
    setModelId("");
    setError(null);
    setStatus("");
    setProvider(defaultProvider);
  };

  const handleAdd = async () => {
    const trimmed = modelId.trim();
    if (!trimmed) return;

    if (provider === "replicate" && !trimmed.includes("/")) {
      setError("Replicate model IDs look like 'owner/model-name'");
      return;
    }

    const id = `${provider}:${trimmed}`;
    if (textModels.some((m) => m.id === id)) {
      setError("Model already added");
      return;
    }

    const apiKey = apiKeys[provider];
    if (!apiKey) {
      setError(`Add a ${provider === "google" ? "Google" : "Replicate"} API key first`);
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("Testing model...");

    try {
      await testTextModel(provider, apiKey, trimmed);
      addCustomTextModel(
        provider,
        trimmed,
        trimmed,
        provider === "google" ? "/icons/google.svg" : undefined
      );
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
        onClick={() => setIsAdding(true)}
        disabled={disabled}
        className={`flex w-full items-center gap-2 rounded-lg border border-dashed border-zinc-700 p-2.5 text-zinc-400 transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-zinc-600 hover:text-zinc-300"
        }`}
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Add custom text model</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-300">Provider</label>
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as ApiKeyProvider);
            setError(null);
          }}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
        >
          <option value="google">Google</option>
          <option value="replicate">Replicate</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-zinc-300">Model ID</label>
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
          placeholder={provider === "google" ? "gemini-3-flash-preview" : "owner/model-name"}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          autoFocus
        />
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
          onClick={reset}
          className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-600"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-zinc-500">
        {status || "A quick test generation runs before saving to verify the model works."}
      </p>
    </div>
  );
}
