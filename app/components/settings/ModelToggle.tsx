import {
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
import { getProvider, normalizeModelId, providerRequiresApiKey, PROVIDERS } from "~/lib/providers";

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
      <span className="bg-surface-interactive/50 text-text-tertiary inline-flex cursor-help items-center gap-1 rounded px-1.5 py-0.5 text-[10px]">
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
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const setModelEnabled = useSettingsStore((s) => s.setModelEnabled);
  const removeCustomModel = useSettingsStore((s) => s.removeCustomModel);
  const updateModelCapabilities = useSettingsStore((s) => s.updateModelCapabilities);
  const updateModelSchemaMapping = useSettingsStore((s) => s.updateModelSchemaMapping);
  const [isRefetching, setIsRefetching] = useState(false);
  const [refetchingStatus, setRefetchingStatus] = useState("");
  const [refetchError, setRefetchError] = useState<string | null>(null);

  const { capabilities } = model;
  const needsRefetch =
    model.isCustom && model.provider === "replicate" && model.schemaFetched === false;

  const handleRefetch = async () => {
    setIsRefetching(true);
    setRefetchError(null);

    try {
      const provider = model.provider;
      const resolve = getProvider(provider).resolveImageModel;
      const apiKey = providerRequiresApiKey(model.provider) ? (apiKeys[model.provider] ?? "") : "";
      if (providerRequiresApiKey(model.provider) && !apiKey) {
        throw new Error(`No API key for ${model.provider}`);
      }
      if (!resolve) throw new Error("Provider can't resolve models");
      const { capabilities, schemaMapping } = await resolve(model.id, apiKey, setRefetchingStatus);

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
      : "Click to refresh schema info.";

  const provider = PROVIDERS[model.provider];

  return (
    <div
      className={`border-c-border/50 bg-surface-overlay/50 flex items-center gap-1 rounded-lg border p-2 py-2.5 ${
        !hasApiKey ? "opacity-50" : ""
      }`}
    >
      {dragHandleProps ? (
        <button
          {...dragHandleProps}
          className="text-text-muted hover:text-text-tertiary shrink-0 cursor-grab touch-none active:cursor-grabbing"
        >
          <div className="bg-surface-interactive text-text-tertiary mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            {model.icon ? (
              <SVG src={model.icon} className="h-5 w-5" />
            ) : (
              <Box className="h-4 w-4" />
            )}
          </div>
        </button>
      ) : (
        <div className="bg-surface-interactive text-text-tertiary mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          {model.icon ? <SVG src={model.icon} className="h-5 w-5" /> : <Box className="h-4 w-4" />}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-text-primary truncate text-sm font-medium">{model.name}</p>
        <div className="mt-0.5 flex items-center gap-1">
          <Tooltip content={provider.label} placement="top" delay={200}>
            <span className="text-accent-muted bg-accent/50 inline-flex cursor-help items-center gap-1 rounded px-1.5 py-0.5 text-[10px]">
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
      {model.isCustom && (
        <Tooltip content={customReplicateTooltip} placement="top" delay={200}>
          <button
            type="button"
            onClick={handleRefetch}
            disabled={isRefetching || !hasApiKey}
            className={`text-text-muted hover:text-accent-muted shrink-0 p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${needsRefetch ? "text-yellow-400" : ""}`}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </Tooltip>
      )}

      {model.isCustom && (
        <button
          onClick={() => removeCustomModel(model.id)}
          className="text-text-muted shrink-0 p-1 transition-colors hover:text-red-400"
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
