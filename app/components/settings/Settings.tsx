import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  Sparkles,
  ChevronDown,
  Loader2,
  Bell,
  MessageSquareText,
  Archive,
  Download,
  Upload,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { GalleryHeader } from "~/components/gallery/GalleryHeader";
import { useSettingsStore } from "~/stores/settingsStore";
import { useGalleryStore } from "~/stores/galleryStore";
import { fetchModelInfo } from "~/lib/replicateSchema";
import { getImageCount } from "~/lib/db";
import { exportAllImages, importFromZip } from "~/lib/exportImport";
import type { Provider } from "~/types";
import ModelToggleItem from "./ModelToggle";
import AddCustomModelButton from "./AddCustomModelButton";
import { Switch } from "~/components/ui/Switch";

const providers: { id: Provider; name: string; description: string; link: string }[] = [
  {
    id: "google",
    name: "Google AI",
    description: "For Gemini image generation models",
    link: "https://aistudio.google.com/",
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "For Flux, GPT Image, and other community models",
    link: "https://replicate.com/",
  },
];

export function SettingsModal() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const textModel = useSettingsStore((s) => s.textModel);
  const desktopNotificationsEnabled = useSettingsStore((s) => s.desktopNotificationsEnabled);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const setTextModel = useSettingsStore((s) => s.setTextModel);
  const setDesktopNotificationsEnabled = useSettingsStore((s) => s.setDesktopNotificationsEnabled);

  const apiKeysDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const desktopNotificationsDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    return Notification.permission;
  });

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
    <main className="flex h-full flex-1 flex-col overflow-hidden bg-zinc-950">
      <GalleryHeader title="Settings" />

      {/* Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* API Keys Section */}
        <details ref={apiKeysDetailsRef} className="group space-y-3" open>
          <summary className="flex w-full cursor-pointer list-none items-center justify-between text-left [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium">API Keys</span>
              {apiKeys.google && apiKeys.replicate && <Check className="h-4 w-4 text-green-500" />}
            </div>
            <ChevronDown className="h-4 w-4 -rotate-90 text-zinc-400 transition-transform duration-200 group-open:rotate-0" />
          </summary>

          <div className="space-y-3 pl-6">
            <p className="text-xs text-zinc-500">Keys are stored locally in your browser.</p>
            {providers.map((provider) => (
              <ApiKeyInput
                key={provider.id}
                provider={provider.id}
                name={provider.name}
                description={provider.description}
                value={apiKeys[provider.id] || ""}
                onChange={(value) => setApiKey(provider.id, value || null)}
                link={provider.link}
              />
            ))}
          </div>
        </details>

        {/* Desktop Notifications Section */}
        <details ref={desktopNotificationsDetailsRef} className="group space-y-3" open>
          <summary className="flex w-full cursor-pointer list-none items-center justify-between text-left [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium">Desktop notifications</span>
              {desktopNotificationsEnabled && notificationPermission === "granted" && (
                <Check className="h-4 w-4 text-green-500" />
              )}
            </div>
            <ChevronDown className="h-4 w-4 -rotate-90 text-zinc-400 transition-transform duration-200 group-open:rotate-0" />
          </summary>

          <div className="ml-6 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-zinc-200">
                Notify when generations complete in background
              </span>
              <Switch
                checked={desktopNotificationsEnabled && notificationPermission === "granted"}
                disabled={notificationPermission !== "granted"}
                onChange={(e) => setDesktopNotificationsEnabled(e.target.checked)}
                aria-label="Toggle desktop notifications"
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

        {/* Text Model Section */}
        <details className="group space-y-3" open>
          <summary className="flex w-full cursor-pointer list-none items-center justify-between text-left [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-medium">Text model</span>
              {(apiKeys.google || apiKeys.replicate) && (
                <Check className="h-4 w-4 text-green-500" />
              )}
            </div>
            <ChevronDown className="h-4 w-4 -rotate-90 text-zinc-400 transition-transform duration-200 group-open:rotate-0" />
          </summary>

          <div className="ml-6 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">
              Used for prompt improvement and smart model configuration.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-300">Provider</label>
              <select
                value={textModel.provider}
                onChange={(e) =>
                  setTextModel({
                    ...textModel,
                    provider: e.target.value as Provider,
                    modelId:
                      e.target.value === "google"
                        ? "gemini-3-flash-preview"
                        : "google/gemini-3-flash",
                  })
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
              >
                <option value="google">Google AI</option>
                <option value="replicate">Replicate</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-300">Model ID</label>
              <input
                type="text"
                value={textModel.modelId}
                onChange={(e) => setTextModel({ ...textModel, modelId: e.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            {!apiKeys[textModel.provider] && (
              <p className="text-xs text-amber-400">
                {apiKeys[textModel.provider === "google" ? "replicate" : "google"]
                  ? `No ${textModel.provider === "google" ? "Google" : "Replicate"} key — will fall back to ${textModel.provider === "google" ? "Replicate" : "Google"}.`
                  : "No API keys configured. Add one above to enable text model features."}
              </p>
            )}
          </div>
        </details>

        {/* Data Section */}
        <DataSection />
      </div>
    </main>
  );
}

function DataSection() {
  const loadImages = useGalleryStore((s) => s.loadImages);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageCount, setImageCount] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getImageCount().then(setImageCount);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      await exportAllImages();
      setStatus("Export complete.");
    } catch (e) {
      setStatus(`Export failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setStatus(null);
    try {
      const result = await importFromZip(file);
      const parts = [`${result.imported} imported`];
      if (result.skipped > 0) parts.push(`${result.skipped} skipped (already exist)`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      setStatus(parts.join(", "));

      if (result.imported > 0) {
        await loadImages();
        setImageCount(await getImageCount());
      }
    } catch (e) {
      setStatus(`Import failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <details className="group space-y-3" open>
      <summary className="flex w-full cursor-pointer list-none items-center justify-between text-left [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium">Data</span>
        </div>
        <ChevronDown className="h-4 w-4 -rotate-90 text-zinc-400 transition-transform duration-200 group-open:rotate-0" />
      </summary>

      <div className="ml-6 space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
        <p className="text-xs text-zinc-500">
          Export or import all images and their metadata as a ZIP file.
          {imageCount !== null && (
            <span className="ml-1 text-zinc-400">
              {imageCount} image{imageCount !== 1 ? "s" : ""} in gallery.
            </span>
          )}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || importing || imageCount === 0}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? "Exporting..." : "Export all images"}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={exporting || importing}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {importing ? "Importing..." : "Import from ZIP"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {status && <p className="text-xs text-zinc-400">{status}</p>}
      </div>
    </details>
  );
}

function ApiKeyInput({
  provider,
  name,
  description,
  value,
  onChange,
  link,
}: {
  provider: Provider;
  name: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  link: string;
}) {
  const [showKey, setShowKey] = useState(false);
  const hasKey = value.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-zinc-200">{name}</label>
          <p className="text-xs text-zinc-500">
            {description} -
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-purple-400 hover:underline"
            >
              Get API key
            </a>
          </p>
        </div>
        {hasKey && <Check className="h-4 w-4 text-green-500" />}
      </div>
      <div className="relative">
        <input
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${name} API key`}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 pr-10 text-sm text-zinc-100 placeholder-zinc-500 transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-zinc-400 transition-colors hover:text-zinc-300"
        >
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
