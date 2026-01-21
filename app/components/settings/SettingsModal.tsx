import { X, Key, Eye, EyeOff, Check, Plus, Trash2, Sparkles, Box, ChevronDown, ChevronUp, Loader2, RectangleHorizontal, Maximize, Image } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import { fetchModelInfo } from "~/lib/replicateSchema";
import type { Provider, StoredModel } from "~/types";

export const SETTINGS_POPOVER_ID = "settings-popover";

const providers: { id: Provider; name: string; description: string }[] = [
  {
    id: "google",
    name: "Google AI",
    description: "For Gemini image generation models",
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "For Flux, GPT Image, and other community models",
  },
];

export function SettingsModal() {
  const closeSettingsModal = useSettingsStore((s) => s.closeSettingsModal);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const models = useSettingsStore((s) => s.models);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const updateModelCapabilities = useSettingsStore((s) => s.updateModelCapabilities);

  const popoverRef = useRef<HTMLDivElement>(null);
  const [apiKeysExpanded, setApiKeysExpanded] = useState(
    !apiKeys.google && !apiKeys.replicate
  );
  const [fetchingSchemas, setFetchingSchemas] = useState(false);

  // Show popover on mount and handle toggle event for closing
  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;

    popover.showPopover();

    const handleToggle = (e: Event) => {
      const toggleEvent = e as ToggleEvent;
      if (toggleEvent.newState === "closed") {
        closeSettingsModal();
      }
    };

    popover.addEventListener("toggle", handleToggle);
    return () => popover.removeEventListener("toggle", handleToggle);
  }, [closeSettingsModal]);

  // Fetch schemas for Replicate models that haven't been fetched yet
  useEffect(() => {
    const unfetchedModels = models.filter(
      (m) => m.provider === "replicate" && !m.schemaFetched && !m.isCustom
    );

    if (unfetchedModels.length === 0 || !apiKeys.replicate) return;

    setFetchingSchemas(true);

    Promise.all(
      unfetchedModels.map(async (model) => {
        try {
          const replicateId = model.id.replace("replicate/", "");
          const { capabilities } = await fetchModelInfo(replicateId, apiKeys.replicate || "");
          updateModelCapabilities(model.id, capabilities, true);
        } catch (err) {
          // Silently fail - keep default capabilities
          console.warn(`Failed to fetch schema for ${model.id}:`, err);
        }
      })
    ).finally(() => {
      setFetchingSchemas(false);
    });
  }, [apiKeys.replicate, models, updateModelCapabilities]);

  const handleClose = () => {
    popoverRef.current?.hidePopover();
  };

  return (
    <div
      ref={popoverRef}
      id={SETTINGS_POPOVER_ID}
      popover="manual"
      className="settings-popover bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 overflow-y-auto flex-1">
        {/* API Keys Section */}
        <div className="space-y-3">
          <button
            onClick={() => setApiKeysExpanded(!apiKeysExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium">API Keys</span>
              {apiKeys.google && apiKeys.replicate && (
                <Check className="w-4 h-4 text-green-500" />
              )}
            </div>
            {apiKeysExpanded ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </button>

          {apiKeysExpanded && (
            <div className="space-y-3 pl-6">
              <p className="text-xs text-zinc-500">
                Keys are stored locally in your browser.
              </p>
              {providers.map((provider) => (
                <ApiKeyInput
                  key={provider.id}
                  provider={provider.id}
                  name={provider.name}
                  description={provider.description}
                  value={apiKeys[provider.id] || ""}
                  onChange={(value) => setApiKey(provider.id, value || null)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Models Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium">Models</span>
            {fetchingSchemas && (
              <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
            )}
          </div>

          <div className="space-y-2">
            {models.map((model) => (
              <ModelToggleItem
                key={model.id}
                model={model}
                hasApiKey={!!apiKeys[model.provider]}
              />
            ))}
          </div>

          <AddCustomModelButton disabled={!apiKeys.replicate} apiKey={apiKeys.replicate} />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800 shrink-0">
        <button
          onClick={handleClose}
          className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ApiKeyInput({
  provider,
  name,
  description,
  value,
  onChange,
}: {
  provider: Provider;
  name: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const hasKey = value.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-zinc-200">{name}</label>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
        {hasKey && <Check className="w-4 h-4 text-green-500" />}
      </div>
      <div className="relative">
        <input
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${name} API key`}
          className="w-full py-2 px-3 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-300 transition-colors"
        >
          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function CapabilityBadge({ icon: Icon, label, enabled }: { icon: React.ElementType; label: string; enabled: boolean }) {
  if (!enabled) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-700/50 text-zinc-400"
      title={label}
    >
      <Icon className="w-2.5 h-2.5" />
    </span>
  );
}

function ModelToggleItem({
  model,
  hasApiKey,
}: {
  model: StoredModel;
  hasApiKey: boolean;
}) {
  const setModelEnabled = useSettingsStore((s) => s.setModelEnabled);
  const removeCustomModel = useSettingsStore((s) => s.removeCustomModel);

  const providerIcon = model.provider === "google" ? (
    <Sparkles className="w-4 h-4" />
  ) : (
    <Box className="w-4 h-4" />
  );

  const { capabilities } = model;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 ${
        !hasApiKey ? "opacity-50" : ""
      }`}
    >
      <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
        {providerIcon}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100 truncate">{model.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-zinc-500 capitalize">{model.provider}</span>
          <div className="flex items-center gap-1">
            <CapabilityBadge
              icon={RectangleHorizontal}
              label="Aspect ratio"
              enabled={capabilities.supportsAspectRatios}
            />
            <CapabilityBadge
              icon={Maximize}
              label="Resolution"
              enabled={capabilities.supportsResolution}
            />
            <CapabilityBadge
              icon={Image}
              label={`Reference images (max ${capabilities.maxReferenceImages})`}
              enabled={capabilities.supportsReferenceImages}
            />
          </div>
        </div>
      </div>

      {model.isCustom && (
        <button
          onClick={() => removeCustomModel(model.id)}
          className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
          title="Remove model"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}

      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          checked={model.enabled}
          onChange={(e) => setModelEnabled(model.id, e.target.checked)}
          className="sr-only peer"
          disabled={!hasApiKey}
        />
        <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:bg-zinc-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white"></div>
      </label>
    </div>
  );
}

function AddCustomModelButton({ disabled, apiKey }: { disabled?: boolean; apiKey: string | null }) {
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
