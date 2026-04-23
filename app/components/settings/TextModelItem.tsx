import { Trash2, Box, Check } from "lucide-react";
import { useSettingsStore } from "~/stores/settingsStore";
import SVG from "react-inlinesvg";
import type { StoredTextModel } from "~/types";
import { Tooltip } from "~/components/ui/Tooltip";

export default function TextModelItem({
  model,
  hasApiKey,
}: {
  model: StoredTextModel;
  hasApiKey: boolean;
}) {
  const selectTextModel = useSettingsStore((s) => s.selectTextModel);
  const removeCustomTextModel = useSettingsStore((s) => s.removeCustomTextModel);

  const handleSelect = () => {
    if (!hasApiKey) return;
    if (model.enabled) return;
    selectTextModel(model.id);
  };

  return (
    <div
      className={`flex items-center gap-1 rounded-lg border p-2.5 transition-colors ${
        model.enabled
          ? "border-purple-600/50 bg-purple-900/20"
          : "border-zinc-700/50 bg-zinc-800/50"
      } ${!hasApiKey ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={model.enabled}
        onClick={handleSelect}
        disabled={!hasApiKey}
        className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-zinc-400">
          {model.icon ? <SVG src={model.icon} className="h-5 w-5" /> : <Box className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-100">{model.name}</p>
          <div className="mt-0.5 flex items-center gap-1">
            <Tooltip
              content={model.provider === "google" ? "Google" : "Replicate"}
              placement="top"
              delay={200}
            >
              <span className="text-zinc-40 inline-flex cursor-help items-center gap-1 rounded bg-purple-700/50 px-1.5 py-0.5 text-[10px] text-purple-400">
                <SVG
                  src={`/icons/${model.provider}.svg`}
                  className="h-2.5 w-2.5 overflow-visible"
                />
              </span>
            </Tooltip>
            <span className="truncate text-[10px] text-zinc-500">{model.modelId}</span>
          </div>
        </div>
      </button>

      {model.isCustom && (
        <button
          type="button"
          onClick={() => removeCustomTextModel(model.id)}
          className="shrink-0 p-1 text-zinc-500 transition-colors hover:text-red-400"
          title="Remove model"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <button
        type="button"
        role="radio"
        aria-checked={model.enabled}
        onClick={handleSelect}
        disabled={!hasApiKey}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed ${
          model.enabled
            ? "border-purple-500 bg-purple-500 text-white"
            : "border-zinc-600 hover:border-zinc-500"
        }`}
        aria-label={`Select ${model.name}`}
      >
        {model.enabled && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
    </div>
  );
}
