import { X, Key, Eye, EyeOff, Check, Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import { fetchModelInfo } from "~/lib/replicateSchema";
import type { Provider } from "~/types";
import ModelToggleItem from "./ModelToggle";
import AddCustomModelButton from "./AddCustomModelButton";

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
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const models = useSettingsStore((s) => s.models);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const updateModelCapabilities = useSettingsStore((s) => s.updateModelCapabilities);

  const [apiKeysExpanded, setApiKeysExpanded] = useState(
    !apiKeys.google && !apiKeys.replicate
  );
  const [fetchingSchemas, setFetchingSchemas] = useState(false);

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

  return (
    <div
      id={SETTINGS_POPOVER_ID}
      popover="auto"
      className="settings-popover m-auto bg-zinc-900 border border-zinc-800 rounded-xl w-[calc(100vw-1rem)] max-w-lg shadow-2xl max-h-[90vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          popoverTarget={SETTINGS_POPOVER_ID}
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
