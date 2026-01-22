import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { fetchModelInfo } from "~/lib/replicateSchema";
import { useSettingsStore } from "~/stores/settingsStore";

export default function AddCustomModelButton({ disabled, apiKey }: { disabled?: boolean; apiKey: string | null }) {
  const [isAdding, setIsAdding] = useState(false);
  const [modelId, setModelId] = useState("");
  const [loading, setLoading] = useState(false);
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
      const { name, capabilities } = await fetchModelInfo(modelId, apiKey!);
      addCustomModel(modelId, name, capabilities);
      setModelId("");
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch model");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        disabled={disabled}
        className={`flex items-center gap-2 w-full p-2.5 rounded-lg border border-dashed border-zinc-700 text-zinc-400 transition-colors ${
          disabled ? "opacity-50 cursor-not-allowed" : "hover:text-zinc-300 hover:border-zinc-600"
        }`}
      >
        <Plus className="w-4 h-4" />
        <span className="text-sm">Add custom Replicate model</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 p-3 rounded-lg border border-zinc-700 bg-zinc-800/50">
      <div className="flex gap-2">
        <input
          type="text"
          value={modelId}
          onChange={(e) => {
            setModelId(e.target.value);
            setError(null);
          }}
          placeholder="owner/model-name"
          className="flex-1 py-2 px-3 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          autoFocus
        />
        <button
          onClick={handleAdd}
          disabled={loading || !modelId.trim()}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
        <button
          onClick={() => {
            setIsAdding(false);
            setModelId("");
            setError(null);
          }}
          className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-zinc-500">
        Enter a Replicate model ID like "stability-ai/sdxl" or "black-forest-labs/flux-schnell"
      </p>
    </div>
  );
}
