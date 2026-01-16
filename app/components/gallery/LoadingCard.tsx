import { useEffect, useRef, useState } from "react";
import { AlertCircle, X, RotateCcw, Clock } from "lucide-react";
import type { GalleryItem, AspectRatio } from "~/types";
import { useGalleryStore } from "~/stores/galleryStore";
import { useImageGeneration } from "~/hooks/useImageGeneration";
import NumberFlow from "@number-flow/react";

interface LoadingCardProps {
  item: GalleryItem;
}

function getAspectRatioValue(aspectRatio: AspectRatio): number {
  const ratios: Record<AspectRatio, number> = {
    "1:1": 1,
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "4:3": 4 / 3,
    "3:4": 3 / 4,
    "21:9": 21 / 9,
  };
  return ratios[aspectRatio] ?? 1;
}

function SineWaveGrid({ frozen = false }: { frozen?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);
  const randsRef = useRef({
    rand1: Math.random(),
    rand2: Math.random(),
    rand3: Math.random(),
    rand4: Math.random(),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gridSize = 8;
    const baseColor = frozen 
      ? { r: 120, g: 120, b: 120 } // grey
      : { r: 138, g: 75, b: 207 }; // purple-500
    const { rand1, rand2, rand3, rand4 } = randsRef.current;

    const animate = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Set canvas size to match container with device pixel ratio
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.fillStyle = "#18181b"; // zinc-900
      ctx.fillRect(0, 0, width, height);

      // Calculate cell size based on canvas dimensions
      const cols = gridSize;
      const rows = Math.ceil((height / width) * gridSize) || gridSize;
      const cellWidth = width / cols;
      const cellHeight = height / rows;
      const maxSize = Math.min(cellWidth, cellHeight);

      // Draw grid of animated squares
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * cellWidth + cellWidth / 2;
          const y = row * cellHeight + cellHeight / 2;

          // Multiple sine waves for more interesting pattern
          const wave1 = Math.sin(col * 0.5 + timeRef.current * 2.0);
          const wave2 = Math.sin(row * rand1 + timeRef.current * 1.5);
          const wave3 = Math.sin((col * rand2 + row * rand3) * 0.4 + timeRef.current * 2.5);
          const wave4 = Math.sin(Math.sqrt(col * col + row * row) * 0.4 - timeRef.current * 1.8 + rand4 * 10);

          const combinedWave = (wave1 + wave2 + wave3 + wave4) / 4;
          const normalizedWave = (combinedWave + 1) / 2; // 0 to 1

          const size = Math.min(maxSize, maxSize * (0.4 + normalizedWave * 0.9));
          const alpha = frozen ? normalizedWave * 0.5 : normalizedWave; // dimmer when greyscale

          // Slight color shift based on wave (only for colored version)
          const hueShift = frozen ? 0 : normalizedWave * 30 - 15;
          const r = Math.min(255, Math.max(0, baseColor.r + hueShift));
          const g = Math.min(255, Math.max(0, baseColor.g - (frozen ? 0 : hueShift * 0.5)));
          const b = baseColor.b;

          ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

          // Draw rounded square
          const halfSize = size / 2;
          const radius = 0;
          ctx.beginPath();
          ctx.roundRect(x - halfSize, y - halfSize, size, size, radius);
          ctx.fill();
        }
      }

      if (!frozen) timeRef.current += 0.016; // ~60fps timing
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [frozen]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full blur-sm"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

export function LoadingCard({ item }: LoadingCardProps) {
  const dismissItem = useGalleryStore((s) => s.dismissItem);
  const { retryItem } = useImageGeneration();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const isFailed = item.status === "failed";
  const isWaiting = item.status === "waiting";
  const isGenerating = item.status === "generating" || item.status === "pending";
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
    dismissItem(item.id);
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
  const retryCount = item.status !== "completed" && item.status !== "failed" ? item.retryCount : undefined;

  return (
    <div
      className="relative rounded-lg overflow-hidden bg-zinc-900 animate-fade-in"
      style={{ aspectRatio }}
    >
      {/* Animated background for generating/pending */}
      {isGenerating && <SineWaveGrid />}

      {/* Animated background for waiting state (greyscale, darkened) */}
      {isWaiting && <SineWaveGrid frozen />}

      {/* Failed state background */}
      {isFailed && <div className="absolute inset-0 bg-red-950/30" />}

      {/* Dismiss button for failed generations */}
      {isFailed && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors z-10"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      )}

      {/* Content overlay for waiting state */}
      {isWaiting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <Clock className="w-8 h-8 mb-2" />
          <p className="text-sm text-center font-medium">
            Rate limited
          </p>
          {countdown !== null && countdown > 0 && (
            <p className="text-xs mt-1">
              Retrying in {" "}
              <NumberFlow
                value={countdown}
                format={{ useGrouping: false }}
                transformTiming={{ duration: 300, easing: 'ease-out' }}
                spinTiming={{ duration: 300, easing: 'ease-out' }}
                opacityTiming={{ duration: 150, easing: 'ease-out' }}
                willChange
              />s
            </p>
          )}
          {retryCount !== undefined && retryCount > 0 && (
            <p className="text-xs mt-1">
              Attempt {retryCount + 1}
            </p>
          )}
        </div>
      )}

      {/* Content overlay for failed state */}
      {isFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-sm text-red-400 text-center line-clamp-2">
            {item.error || "Generation failed"}
          </p>
          {item.canRetry && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Retry'}
            </button>
          )}
        </div>
      )}

      {/* Generating text overlay */}
      {isGenerating && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm text-white/80 font-medium drop-shadow-lg">
            Generating...
          </p>
          {retryCount !== undefined && retryCount > 0 && (
            <p className="text-xs text-white/60 mt-1">
              Attempt {retryCount + 1}
            </p>
          )}
        </div>
      )}

      {/* Model badge */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white/90">
        {item.modelName}
      </div>
    </div>
  );
}
