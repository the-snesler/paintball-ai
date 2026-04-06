import { GripVertical, Maximize, RectangleHorizontal, Trash2, Image, Box } from "lucide-react";
import { useSettingsStore } from "~/stores/settingsStore";
import SVG from "react-inlinesvg";
import type { StoredModel } from "~/types";
import { Tooltip } from "~/components/ui/Tooltip";

function CapabilityBadge({
  icon: Icon,
  label,
  enabled,
}: {
  icon: React.ElementType;
  label: string;
  enabled: boolean;
}) {
  if (!enabled) return null;
  return (
    <Tooltip content={label} placement="top" delay={200}>
      <span className="inline-flex cursor-help items-center gap-1 rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-400">
        <Icon className="h-2.5 w-2.5" />
      </span>
    </Tooltip>
  );
}

export default function ModelToggleItem({
  model,
  hasApiKey,
  dragHandleProps,
}: {
  model: StoredModel;
  hasApiKey: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const setModelEnabled = useSettingsStore((s) => s.setModelEnabled);
  const removeCustomModel = useSettingsStore((s) => s.removeCustomModel);

  const { capabilities } = model;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2.5 ${
        !hasApiKey ? "opacity-50" : ""
      }`}
    >
      {dragHandleProps && (
        <button
          {...dragHandleProps}
          className="shrink-0 cursor-grab touch-none text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-zinc-400">
        {model.icon ? <SVG src={model.icon} className="h-5 w-5" /> : <Box className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{model.name}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
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
          className="shrink-0 p-1.5 text-zinc-500 transition-colors hover:text-red-400"
          title="Remove model"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          checked={model.enabled}
          onChange={(e) => setModelEnabled(model.id, e.target.checked)}
          className="peer sr-only"
          disabled={!hasApiKey}
        />
        <div className="peer h-5 w-9 rounded-full bg-zinc-700 peer-checked:bg-purple-600 peer-focus:outline-none after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-zinc-400 after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white rtl:peer-checked:after:-translate-x-full"></div>
      </label>
    </div>
  );
}
