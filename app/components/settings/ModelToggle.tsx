import { Maximize, RectangleHorizontal, Trash2, Image, Box } from "lucide-react";
import { useSettingsStore } from "~/stores/settingsStore";
import SVG from "react-inlinesvg";
import type { StoredModel } from "~/types";


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

export default function ModelToggleItem({
  model,
  hasApiKey,
}: {
  model: StoredModel;
  hasApiKey: boolean;
}) {
  const setModelEnabled = useSettingsStore((s) => s.setModelEnabled);
  const removeCustomModel = useSettingsStore((s) => s.removeCustomModel);

  const { capabilities } = model;

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 ${
        !hasApiKey ? "opacity-50" : ""
      }`}
    >
      <div className="w-7 h-7 rounded-lg bg-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
        {model.icon ? (
          <SVG src={model.icon} className="w-5 h-5" />
        ) : (
          <Box className="w-4 h-4" />
        )}
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
