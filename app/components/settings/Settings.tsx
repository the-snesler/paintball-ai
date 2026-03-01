import { X, Key, Eye, EyeOff, Check, Sparkles, ChevronDown, Loader2, Bell } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useSettingsStore } from "~/stores/settingsStore";
import { useGalleryStore } from "~/stores/galleryStore";
import { fetchModelInfo } from "~/lib/replicateSchema";
import type { Provider } from "~/types";
import ModelToggleItem from "./ModelToggle";
import AddCustomModelButton from "./AddCustomModelButton";

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
  const desktopNotificationsEnabled = useSettingsStore((s) => s.desktopNotificationsEnabled);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const setDesktopNotificationsEnabled = useSettingsStore((s) => s.setDesktopNotificationsEnabled);
  const updateModelCapabilities = useSettingsStore((s) => s.updateModelCapabilities);
  const openGalleryPanel = useGalleryStore((s) => s.openGalleryPanel);

  const apiKeysDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const desktopNotificationsDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const didSetInitialDetailsOpen = useRef(false);
  const [fetchingSchemas, setFetchingSchemas] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    () => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported";
      }

      return Notification.permission;
    }
  );

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

  useEffect(() => {
    if (didSetInitialDetailsOpen.current) {
      return;
    }

    if (apiKeysDetailsRef.current) {
      apiKeysDetailsRef.current.open = !apiKeys.google && !apiKeys.replicate;
    }

    if (desktopNotificationsDetailsRef.current) {
      desktopNotificationsDetailsRef.current.open = notificationPermission !== "granted";
    }

    didSetInitialDetailsOpen.current = true;
  }, [apiKeys.google, apiKeys.replicate]);

  useEffect(() => {
    if (notificationPermission === "unsupported") return;

    const syncPermission = () => {
      setNotificationPermission(Notification.permission);
    };

    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);

    return () => {
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, [notificationPermission]);

  useEffect(() => {
    if (notificationPermission !== "granted" && desktopNotificationsEnabled) {
      setDesktopNotificationsEnabled(false);
    }
  }, [notificationPermission, desktopNotificationsEnabled, setDesktopNotificationsEnabled]);

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    setRequestingPermission(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setNotificationPermission(nextPermission);

      if (nextPermission === "granted") {
        setDesktopNotificationsEnabled(true);
      }

      if (nextPermission === "denied") {
        setDesktopNotificationsEnabled(false);
      }
    } finally {
      setRequestingPermission(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950">
      {/* Header */}
      <div className="flex items-center px-6 py-4 h-18 border-b border-zinc-800 shrink-0 gap-2">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Settings</h2>
        <div className="flex-1" />
        <button
          onClick={openGalleryPanel}
          className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Close settings"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 overflow-y-auto flex-1">
        {/* API Keys Section */}
        <details
          ref={apiKeysDetailsRef}
          className="group space-y-3"
        >
          <summary className="flex items-center justify-between w-full text-left cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium">API Keys</span>
              {apiKeys.google && apiKeys.replicate && (
                <Check className="w-4 h-4 text-green-500" />
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-zinc-400 -rotate-90 transition-transform duration-200 group-open:rotate-0" />
          </summary>

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
        </details>

        {/* Desktop Notifications Section */}
        <details
          ref={desktopNotificationsDetailsRef}
          className="group space-y-3"
        >
          <summary className="flex items-center justify-between w-full text-left cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium">Desktop notifications</span>
              {desktopNotificationsEnabled && notificationPermission === "granted" && (
                <Check className="w-4 h-4 text-green-500" />
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-zinc-400 -rotate-90 transition-transform duration-200 group-open:rotate-0" />
          </summary>

          <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 ml-6">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-zinc-200">Notify when generations complete in background</span>
              <input
                type="checkbox"
                checked={desktopNotificationsEnabled && notificationPermission === "granted"}
                disabled={notificationPermission !== "granted"}
                onChange={(e) => setDesktopNotificationsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-purple-500 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50 accent-accent"
              />
            </label>

            <p className="text-xs text-zinc-500">
              {notificationPermission === "unsupported"
                ? "Desktop notifications are not supported in this browser."
                : notificationPermission === "granted"
                  ? "Permission granted. You can toggle notifications on or off."
                  : notificationPermission === "denied"
                    ? "Permission is blocked. Enable notifications for this site in your browser settings."
                    : "Grant permission to enable completion notifications."}
            </p>

            {notificationPermission === "default" && (
              <button
                type="button"
                onClick={requestNotificationPermission}
                disabled={requestingPermission}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestingPermission ? "Requesting..." : "Request permission"}
              </button>
            )}
          </div>
        </details>

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

    </main>
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
