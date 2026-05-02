import { useEffect, useRef, useState } from "react";
import { AlertCircle, X, RotateCcw, Clock, Upload } from "lucide-react";
import type { GalleryItem } from "~/types";
import { useGalleryStore } from "~/stores/galleryStore";
import { useImageGeneration } from "~/hooks/useImageGeneration";
import NumberFlow from "@number-flow/react";
import { SineWaveGrid } from "./SineWaveGrid";
import { getAspectRatioValue } from "~/lib/util";
import { getImageDimensions } from "~/lib/imageProcessing";
import { resolveManualItem, rejectManualItem } from "~/lib/providers/debug";

interface LoadingCardProps {
  item: GalleryItem;
}

export function LoadingCard({ item }: LoadingCardProps) {
  const dismissItem = useGalleryStore((s) => s.dismissItem);
  const { retryItem } = useImageGeneration();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFailed = item.status === "failed";
  const isWaiting = item.status === "waiting";
  const isGenerating = item.status === "generating" || item.status === "pending";
  const isManual = item.modelId === "debug/manual";
  const generationLabel =
    item.status === "pending"
      ? item.pendingPhase === "writing"
        ? "Writing..."
        : item.pendingPhase === "variating"
          ? "Variating..."
          : "Generating..."
      : "Generating...";
  const aspectRatio = getAspectRatioValue(item.aspectRatio);

  // Countdown timer for waiting state
  useEffect(() => {
    if (item.status !== "waiting") {
      setCountdown(null);
      return;
    }

    const waitingUntil = item.waitingUntil;
    if (!waitingUntil) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.ceil((waitingUntil - Date.now()) / 1000);
      setCountdown(Math.max(0, remaining));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [item.status, item.status === "waiting" ? item.waitingUntil : undefined]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isManual && !isFailed) rejectManualItem(item.id);
    dismissItem(item.id);
  };

  const handleManualFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const { width, height } = await getImageDimensions(file);
    resolveManualItem(item.id, {
      blob: file,
      width,
      height,
      metadata: { manual: true, generatedAt: new Date().toISOString() },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleManualFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleManualFile(file);
    e.target.value = "";
  };

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRetrying(true);
    try {
      await retryItem(item.id);
    } finally {
      setIsRetrying(false);
    }
  };

  // Get retry info for display
  const retryCount =
    item.status !== "completed" && item.status !== "failed" ? item.retryCount : undefined;

  return (
    <div
      className="animate-fade-in relative overflow-hidden rounded-lg bg-surface-raised"
      style={{ aspectRatio }}
    >
      {/* Animated background for generating/pending */}
      {isGenerating && !isManual && <SineWaveGrid />}

      {/* Animated background for waiting state (greyscale, darkened) */}
      {isWaiting && <SineWaveGrid frozen />}

      {/* Failed state background */}
      {isFailed && <div className="absolute inset-0 bg-red-950/30" />}

      {/* Manual upload drop zone */}
      {isManual && !isFailed && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
          <div
            className={`absolute inset-0 m-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed transition-colors ${
              isDragOver
                ? "border-purple-400 bg-purple-500/10"
                : "border-zinc-600 hover:border-zinc-400"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-6 w-6 text-text-tertiary" />
            <p className="text-sm font-medium text-text-secondary">Drop image here</p>
            <p className="text-xs text-text-muted">or click to browse</p>
          </div>
        </>
      )}

      {/* Dismiss button — shown for failed generations and manual pending items */}
      {(isFailed || (isManual && !isFailed)) && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 transition-colors hover:bg-black/80"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-text-tertiary" />
        </button>
      )}

      {/* Content overlay for waiting state */}
      {isWaiting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <Clock className="mb-2 h-8 w-8" />
          <p className="text-center text-sm font-medium">Rate limited</p>
          {countdown !== null && countdown > 0 && (
            <p className="mt-1 text-xs">
              Retrying in{" "}
              <NumberFlow
                value={countdown}
                format={{ useGrouping: false }}
                transformTiming={{ duration: 300, easing: "ease-out" }}
                spinTiming={{ duration: 300, easing: "ease-out" }}
                opacityTiming={{ duration: 150, easing: "ease-out" }}
                willChange
              />
              s
            </p>
          )}
          {retryCount !== undefined && retryCount > 0 && (
            <p className="mt-1 text-xs">Attempt {retryCount + 1}</p>
          )}
        </div>
      )}

      {/* Content overlay for failed state */}
      {isFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <AlertCircle className="mb-2 h-8 w-8 text-red-400" />
          <div className="max-h-28 w-full max-w-full overflow-y-auto rounded-md bg-black/20 px-2 py-1">
            <p className="text-xs wrap-break-word whitespace-pre-wrap text-red-300">
              {item.error || "Generation failed"}
            </p>
          </div>
          {item.canRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="mt-3 flex items-center gap-1.5 rounded-md bg-red-500/20 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/30 disabled:opacity-50"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Retrying..." : "Retry"}
            </button>
          )}
        </div>
      )}

      {/* Generating text overlay */}
      {isGenerating && !isManual && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-white/80 drop-shadow-lg">{generationLabel}</p>
          {retryCount !== undefined && retryCount > 0 && (
            <p className="mt-1 text-xs text-white/60">Attempt {retryCount + 1}</p>
          )}
        </div>
      )}

      {/* Model badge */}
      <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white/90 backdrop-blur-sm">
        {item.modelName}
      </div>
    </div>
  );
}
