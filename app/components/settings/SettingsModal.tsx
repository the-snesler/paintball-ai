import { X, Key, Eye, EyeOff, Check } from "lucide-react";
import { useState } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import type { Provider } from "~/types";

const providers: { id: Provider; name: string; description: string }[] = [
  {
    id: "google",
    name: "Google AI",
    description: "For Gemini image generation models",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "For GPT Image and DALL-E models",
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "For Flux and other community models",
  },
];

export function SettingsModal() {
  const closeSettingsModal = useSettingsStore((s) => s.closeSettingsModal);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const setApiKey = useSettingsStore((s) => s.setApiKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeSettingsModal}
      />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md mx-4 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold">API Keys</h2>
          </div>
          <button
            onClick={closeSettingsModal}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-zinc-400">
            Enter your API keys to enable image generation. Keys are stored locally in
            your browser.
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

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={closeSettingsModal}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
          >
            Done
          </button>
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
    <div className="space-y-2">
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
