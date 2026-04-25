import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettingsStore } from "~/stores/settingsStore";

type PromptPermissionState = NotificationPermission | "unsupported";

function getNotificationPermission(): PromptPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

export function NotificationPermissionPrompt() {
  const requestedOutputCount = useSettingsStore((s) => s.requestedOutputCount);
  const notificationPromptDismissed = useSettingsStore((s) => s.notificationPromptDismissed);
  const setDesktopNotificationsEnabled = useSettingsStore((s) => s.setDesktopNotificationsEnabled);
  const dismissNotificationPrompt = useSettingsStore((s) => s.dismissNotificationPrompt);

  const [permission, setPermission] = useState<PromptPermissionState>(getNotificationPermission);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (permission === "unsupported") return;

    const syncPermission = () => {
      setPermission(getNotificationPermission());
    };

    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);

    return () => {
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, [permission]);

  const shouldShow =
    permission === "default" && requestedOutputCount >= 2 && !notificationPromptDismissed;

  if (!shouldShow) {
    return null;
  }

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    setIsRequesting(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission === "granted") {
        setDesktopNotificationsEnabled(true);
      }

      if (nextPermission === "denied") {
        setDesktopNotificationsEnabled(false);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="fixed right-4 bottom-4 z-40 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-border-subtle bg-surface-raised/95 p-4 shadow-xl backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-surface-overlay p-2">
          <Bell className="h-4 w-4 text-accent-muted" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-primary">Desktop notifications</p>
          <p className="mt-1 text-xs leading-relaxed text-text-tertiary">
            Get notified when image generations finish while this tab is in the background.
          </p>
          <p className="mt-2 text-[11px] text-text-muted">
            You can also enable this later in Settings.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={requestPermission}
              disabled={isRequesting}
              className="rounded-lg bg-purple-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-400 disabled:cursor-not-allowed disabled:bg-purple-500/60"
            >
              {isRequesting ? "Requesting..." : "Enable"}
            </button>
            <button
              type="button"
              onClick={dismissNotificationPrompt}
              className="rounded-lg bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-interactive"
            >
              Dismiss
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismissNotificationPrompt}
          className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-secondary"
          aria-label="Dismiss notification prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
