import { GripVertical, Box, Trash2 } from "lucide-react";
import { useSettingsStore } from "~/stores/settingsStore";
import SVG from "react-inlinesvg";
import type { StoredUpscaler } from "~/types";
import { Tooltip } from "~/components/ui/Tooltip";
import { Switch } from "~/components/ui/Switch";

export default function UpscalerItem({
  upscaler,
  hasApiKey,
  dragHandleProps,
}: {
  upscaler: StoredUpscaler;
  hasApiKey: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const setUpscalerEnabled = useSettingsStore((s) => s.setUpscalerEnabled);
  const removeCustomUpscaler = useSettingsStore((s) => s.removeCustomUpscaler);

  return (
    <div
      className={`border-c-border/50 bg-surface-overlay/50 flex items-center gap-1 rounded-lg border p-2.5 ${
        !hasApiKey ? "opacity-50" : ""
      }`}
    >
      {dragHandleProps ? (
        <button
          {...dragHandleProps}
          className="text-text-muted hover:text-text-tertiary shrink-0 cursor-grab touch-none active:cursor-grabbing"
        >
          <div className="bg-surface-interactive text-text-tertiary mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            {upscaler.icon ? (
              <SVG src={upscaler.icon} className="h-5 w-5" />
            ) : (
              <Box className="h-4 w-4" />
            )}
          </div>
        </button>
      ) : (
        <div className="bg-surface-interactive text-text-tertiary mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          {upscaler.icon ? (
            <SVG src={upscaler.icon} className="h-5 w-5" />
          ) : (
            <Box className="h-4 w-4" />
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-text-primary truncate text-sm font-medium">{upscaler.name}</p>
        <div className="mt-0.5 flex items-center gap-1">
          <Tooltip content="Replicate" placement="top" delay={200}>
            <span className="text-accent-muted bg-accent/50 inline-flex cursor-help items-center gap-1 rounded px-1.5 py-0.5 text-[10px]">
              <SVG src="/icons/replicate.svg" className="h-2.5 w-2.5 overflow-visible" />
            </span>
          </Tooltip>
        </div>
      </div>

      {upscaler.isCustom && (
        <button
          onClick={() => removeCustomUpscaler(upscaler.id)}
          className="text-text-muted shrink-0 p-1 transition-colors hover:text-red-400"
          title="Remove upscaler"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      <Switch
        checked={upscaler.enabled}
        onChange={(e) => setUpscalerEnabled(upscaler.id, e.target.checked)}
        disabled={!hasApiKey}
        aria-label={`Toggle ${upscaler.name}`}
      />
    </div>
  );
}
