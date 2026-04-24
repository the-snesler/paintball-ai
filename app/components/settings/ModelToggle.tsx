import {
  GripVertical,
  Maximize,
  RectangleHorizontal,
  Trash2,
  Image,
  Box,
  RefreshCw,
  GalleryHorizontalEnd,
  Sparkles,
} from "lucide-react";
import { useSettingsStore } from "~/stores/settingsStore";
import SVG from "react-inlinesvg";
import { useState } from "react";
import type { StoredModel } from "~/types";
import { Tooltip } from "~/components/ui/Tooltip";
import { Switch } from "~/components/ui/Switch";
import { getProvider, PROVIDERS } from "~/lib/providers";

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
  const updateModelCapabilities = useSettingsStore((s) => s.updateModelCapabilities);
  const updateModelSchemaMapping = useSettingsStore((s) => s.updateModelSchemaMapping);
  const replicateApiKey = useSettingsStore((s) => s.apiKeys.replicate);
  const [isRefetching, setIsRefetching] = useState(false);
  const [refetchingStatus, setRefetchingStatus] = useState("");
  const [refetchError, setRefetchError] = useState<string | null>(null);

  const { capabilities } = model;
  const isCustomReplicate = model.isCustom && model.provider === "replicate";
  const needsRefetch = isCustomReplicate && model.schemaFetched === false;

  const handleRefetch = async () => {
    if (!replicateApiKey) {
      setRefetchError("Add a Replicate API key to re-fetch schema info.");
      return;
    }

    setIsRefetching(true);
    setRefetchError(null);

    try {
      const replicateId = model.id.replace("replicate/", "");
      const resolve = getProvider("replicate").resolveImageModel;
      if (!resolve) throw new Error("Replicate provider can't resolve models");
      const { capabilities, schemaMapping } = await resolve(
        replicateId,
        replicateApiKey,
        setRefetchingStatus
      );

      updateModelCapabilities(model.id, capabilities, true);
      if (schemaMapping) {
        updateModelSchemaMapping(model.id, schemaMapping);
      }
    } catch (error) {
      setRefetchError(error instanceof Error ? error.message : "Failed to re-fetch schema");
    } finally {
      setIsRefetching(false);
    }
  };

  const customReplicateTooltip = isRefetching
    ? refetchingStatus
    : needsRefetch
      ? "Schema update available. Click to refresh."
      : "Custom Replicate model. Click to refresh schema info.";

  const provider = PROVIDERS[model.provider];

  return (
    <div
      className={`flex items-center gap-1 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2 py-2.5 ${
        !hasApiKey ? "opacity-50" : ""
      }`}
    >
      {dragHandleProps ? (
        <button
          {...dragHandleProps}
          className="shrink-0 cursor-grab touch-none text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
        >
          <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-zinc-400">
            {model.icon ? (
              <SVG src={model.icon} className="h-5 w-5" />
            ) : (
              <Box className="h-4 w-4" />
            )}
          </div>
        </button>
      ) : (
        <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-zinc-400">
          {model.icon ? <SVG src={model.icon} className="h-5 w-5" /> : <Box className="h-4 w-4" />}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{model.name}</p>
        <div className="mt-0.5 flex items-center gap-1">
          <Tooltip content={provider.label} placement="top" delay={200}>
            <span className="text-zinc-40 inline-flex cursor-help items-center gap-1 rounded bg-purple-700/50 px-1.5 py-0.5 text-[10px] text-purple-400">
              <SVG src={provider.iconPath} className="h-2.5 w-2.5 overflow-visible" />
            </span>
          </Tooltip>
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
            icon={Sparkles}
            label="Quality"
            enabled={Boolean(capabilities.supportsQuality)}
          />
          <CapabilityBadge
            icon={Image}
            label={`Reference images (max ${capabilities.maxReferenceImages})`}
            enabled={capabilities.supportsReferenceImages}
          />
          <CapabilityBadge
            icon={GalleryHorizontalEnd}
            label={`Batch generation (max ${capabilities.maxImagesPerRequest})`}
            enabled={Boolean(capabilities.supportsNumberOfImages)}
          />
        </div>
      </div>

      {refetchError && <p className="mt-1 text-[10px] text-red-400">{refetchError}</p>}
      {isCustomReplicate && (
        <Tooltip content={customReplicateTooltip} placement="top" delay={200}>
          <button
            type="button"
            onClick={handleRefetch}
            disabled={isRefetching || !hasApiKey}
            className={`shrink-0 p-1 text-zinc-500 transition-colors hover:text-purple-400 disabled:cursor-not-allowed disabled:opacity-50 ${needsRefetch ? "text-yellow-400" : ""}`}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </Tooltip>
      )}

      {model.isCustom && (
        <button
          onClick={() => removeCustomModel(model.id)}
          className="shrink-0 p-1 text-zinc-500 transition-colors hover:text-red-400"
          title="Remove model"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      <Switch
        checked={model.enabled}
        onChange={(e) => setModelEnabled(model.id, e.target.checked)}
        disabled={!hasApiKey}
        aria-label={`Toggle ${model.name}`}
      />
    </div>
  );
}
