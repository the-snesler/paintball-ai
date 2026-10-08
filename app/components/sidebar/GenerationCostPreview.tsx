import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Tooltip } from "~/components/ui/Tooltip";
import { getImageStatRecords } from "~/lib/db";
import { doesModelSupportAspectRatio } from "~/lib/models";
import { type ImageStatRecord } from "~/lib/stats";
import { formatUsd } from "~/lib/util";
import { useGalleryStore } from "~/stores/galleryStore";
import type { AspectRatio, Resolution, StoredModel } from "~/types";

interface Props {
  models: StoredModel[];
  modelSelections: Record<string, number>;
  aspectRatio: AspectRatio | null;
  resolution: Resolution;
  quality: string | null;
  numberOfImages: number;
  referenceCount: number;
}

export function GenerationCostPreview({
  models,
  modelSelections,
  aspectRatio,
  resolution,
  quality,
  numberOfImages,
  referenceCount,
}: Props) {
  const totalCount = useGalleryStore((s) => s.totalCount);
  const [records, setRecords] = useState<ImageStatRecord[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Read all saved costs, including images outside the gallery's loaded page.
  useEffect(() => {
    let canceled = false;
    setLoadFailed(false);
    getImageStatRecords().then(
      (history) => {
        if (!canceled) setRecords(history);
      },
      () => {
        if (!canceled) setLoadFailed(true);
      }
    );
    return () => {
      canceled = true;
    };
  }, [totalCount]);

  const estimates = useMemo(
    () =>
      Object.entries(modelSelections)
        .filter(([, count]) => count > 0)
        .map(([modelId, count]) => {
          const model = models.find((m) => m.id === modelId);
          const taskResolution = model?.capabilities.supportsResolution ? resolution : null;
          const taskQuality = model?.capabilities.supportsQuality ? quality : null;
          const taskAspectRatio =
            model && aspectRatio && doesModelSupportAspectRatio(model, aspectRatio)
              ? aspectRatio
              : null;
          const outputs =
            count *
            (model?.capabilities.supportsNumberOfImages
              ? Math.max(1, Math.min(numberOfImages, model.capabilities.maxImagesPerRequest ?? 1))
              : 1);
          const matches = (records ?? []).filter(
            (r) =>
              r.modelId === modelId &&
              r.resolution === taskResolution &&
              r.quality === taskQuality &&
              r.aspectRatio === taskAspectRatio &&
              r.referenceCount === referenceCount &&
              !r.isUpscale &&
              !r.isEdit &&
              r.costUsd !== null &&
              Number.isFinite(r.costUsd) &&
              r.costUsd >= 0
          );
          const usd = matches.length
            ? (matches.reduce((sum, r) => sum + r.costUsd!, 0) / matches.length) * outputs
            : null;
          const sources = [
            ...new Set(matches.flatMap((r) => r.costEstimate?.pricing.source.url ?? [])),
          ];
          return {
            modelId,
            name: model?.name ?? modelId,
            outputs,
            usd,
            samples: matches.length,
            sources,
          };
        }),
    [
      records,
      models,
      modelSelections,
      aspectRatio,
      resolution,
      quality,
      numberOfImages,
      referenceCount,
    ]
  );

  if (!estimates.length) return null;
  const priced = estimates.filter((e) => e.usd !== null);
  const partial = priced.length < estimates.length;
  const total = priced.reduce((sum, e) => sum + e.usd!, 0);

  return (
    <div className="flex w-full justify-center">
      <Tooltip
        placement="top"
        maxWidth="max-w-80"
        content={
          <div className="space-y-2">
            <p>
              Average saved per-image estimates with the same model, resolution, quality, aspect
              ratio, and reference count, multiplied by requested outputs.
            </p>
            {estimates.map((e) => (
              <div key={e.modelId}>
                <p className="text-text-primary">
                  {e.name} × {e.outputs}: {e.usd === null ? "unavailable" : formatUsd(e.usd)}
                </p>
                <p>
                  {e.samples
                    ? `${e.samples} matching image${e.samples === 1 ? "" : "s"}. ${e.samples < 5 ? "Low" : "Medium"} confidence (${e.samples < 5 ? "fewer than 5 samples" : "5+ samples; usage may vary"}).`
                    : "No matching priced history."}
                </p>
                {e.sources.map((source) => (
                  <p key={source} className="break-all">
                    Pricing source: {source}
                  </p>
                ))}
              </div>
            ))}
            {partial && <p>Unpriced models are excluded from the subtotal.</p>}
            <p>
              Historical pricing may be outdated. Prompt and reference contents affect usage.
              Excludes prompt improvement and variation costs. Actual billing may vary.
            </p>
            {loadFailed && <p>Could not load saved pricing history.</p>}
          </div>
        }
      >
        <span className="text-text-tertiary inline-flex cursor-help items-center gap-1 text-xs">
          {loadFailed
            ? "Estimated cost unavailable"
            : records === null
              ? "Estimating cost…"
              : priced.length
                ? `${partial ? "Estimated subtotal" : "Estimated total"}: ~${formatUsd(total)}`
                : "Estimated cost unavailable"}
          <Info className="h-3 w-3" />
        </span>
      </Tooltip>
    </div>
  );
}
