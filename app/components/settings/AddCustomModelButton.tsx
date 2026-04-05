import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { resolveModelCapabilities } from "~/lib/replicateSchema";
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

  const addCustomModel = useSettingsStore((s) => s.addCustomModel);
  const models = useSettingsStore((s) => s.models);

  const handleAdd = async () => {
    if (!modelId.trim()) return;

    // Validate format (owner/model)
    if (!modelId.includes("/")) {
      setError("Format: owner/model-name");
      return;
    }

    // Check if already exists
    const fullId = `replicate/${modelId}`;
    if (models.some((m) => m.id === fullId)) {
      setError("Model already added");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { name, capabilities, schemaMapping, icon } = await resolveModelCapabilities(
        modelId,
        apiKey!,
        setLoadingStatus
      );

      addCustomModel(modelId, name, capabilities, schemaMapping, icon);
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
      <div className="flex gap-2">
        <input
          type="text"
          value={modelId}
          onChange={(e) => {
            setModelId(e.target.value);
            setError(null);
          }}
          placeholder="owner/model-name"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          autoFocus
        />
        <button
          onClick={handleAdd}
          disabled={loading || !modelId.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
        <button
          onClick={() => {
            setIsAdding(false);
            setModelId("");
            setError(null);
          }}
          className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-600"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-zinc-500">
        {loadingStatus ||
          'Enter a Replicate model ID like "stability-ai/sdxl" or "black-forest-labs/flux-schnell"'}
      </p>
    </div>
  );
}
