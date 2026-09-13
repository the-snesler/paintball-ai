import { Image } from "lucide-react";
import { useEffect, useState } from "react";
import { enqueueMissingEmbeddings, refreshEmbeddingCounts } from "~/lib/embeddingQueue";
import { useEmbeddingStatusStore } from "~/stores/embeddingStatusStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { Switch } from "~/components/ui/Switch";
import { SemanticSearchStatus } from "./SemanticSearchStatus";
import { SettingsSectionHeader } from "./SettingsSectionHeader";

export function GallerySection() {
  const desktopNotificationsEnabled = useSettingsStore((s) => s.desktopNotificationsEnabled);
  const semanticSearchEnabled = useSettingsStore((s) => s.semanticSearchEnabled);
  const setDesktopNotificationsEnabled = useSettingsStore((s) => s.setDesktopNotificationsEnabled);
  const setSemanticSearchEnabled = useSettingsStore((s) => s.setSemanticSearchEnabled);
  const semanticModelId = useEmbeddingStatusStore((s) => s.modelId);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  });

  useEffect(() => {
    if (notificationPermission === "unsupported") return;
    const syncPermission = () => setNotificationPermission(Notification.permission);
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
  }, [desktopNotificationsEnabled, notificationPermission, setDesktopNotificationsEnabled]);

  const handleToggleSemanticSearch = (enabled: boolean) => {
    setSemanticSearchEnabled(enabled);
    if (enabled) {
      enqueueMissingEmbeddings(semanticModelId);
      refreshEmbeddingCounts(semanticModelId);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setRequestingPermission(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setNotificationPermission(nextPermission);
      if (nextPermission === "granted") setDesktopNotificationsEnabled(true);
      if (nextPermission === "denied") setDesktopNotificationsEnabled(false);
    } finally {
      setRequestingPermission(false);
    }
  };

  return (
    <section id="gallery" className="group space-y-3">
      <SettingsSectionHeader
        icon={Image}
        title="Gallery"
        subtitle="Manage your generated images. You can view, delete, and organize your images in the gallery."
      />

      <div className="pl-6">
        <div className="border-border-subtle bg-surface-raised/60 divide-border-subtle divide-y rounded-lg border">
          <div className="space-y-3 p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-text-secondary text-sm">Enable semantic image search</span>
              <Switch
                checked={semanticSearchEnabled}
                onChange={(event) => handleToggleSemanticSearch(event.target.checked)}
                aria-label="Toggle semantic image search"
              />
            </label>
            <p className="text-text-muted text-xs">
              Downloads a ~400MB model on first use and runs it locally. Embeddings are computed in
              the background while you wait for generations and let you search by image content as
              well as prompt text. All processing stays in your browser.
            </p>
            {semanticSearchEnabled && <SemanticSearchStatus />}
          </div>

          <div className="space-y-3 p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-text-secondary text-sm">
                Notify when generations complete in background
              </span>
              <Switch
                checked={desktopNotificationsEnabled && notificationPermission === "granted"}
                disabled={notificationPermission !== "granted"}
                onChange={(event) => setDesktopNotificationsEnabled(event.target.checked)}
                aria-label="Toggle desktop notifications"
              />
            </label>
            <p className="text-text-muted text-xs">
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
                className="bg-surface-overlay text-text-secondary hover:bg-surface-interactive rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestingPermission ? "Requesting..." : "Request permission"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
