import { useEffect, useRef } from "react";
import { AlertCircle, X } from "lucide-react";
import type { GalleryItem, AspectRatio } from "~/types";
import { useGalleryStore } from "~/stores/galleryStore";

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

function SineWaveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const rand1 = Math.random();
  const rand2 = Math.random();
  const rand3 = Math.random();
  const rand4 = Math.random();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let time = 0;
    const gridSize = 8;
    const baseColor = { r: 138, g: 75, b: 207 }; // purple-500

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
          const wave1 = Math.sin(col * 0.5 + time * 2.0);
          const wave2 = Math.sin(row * rand1 + time * 1.5);
          const wave3 = Math.sin((col * rand2 + row * rand3) * 0.4 + time * 2.5);
          const wave4 = Math.sin(Math.sqrt(col * col + row * row) * 0.4 - time * 1.8 + rand4 * 10);

          const combinedWave = (wave1 + wave2 + wave3 + wave4) / 4;
          const normalizedWave = (combinedWave + 1) / 2; // 0 to 1

          const size = Math.min(maxSize, maxSize * (0.4 + normalizedWave * 0.9));
          const alpha = normalizedWave;

          // Slight color shift based on wave
          const hueShift = normalizedWave * 30 - 15;
          const r = Math.min(255, Math.max(0, baseColor.r + hueShift));
          const g = Math.min(255, Math.max(0, baseColor.g - hueShift * 0.5));
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

      time += 0.016; // ~60fps timing
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

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
  const isFailed = item.status === "failed";
  const aspectRatio = getAspectRatioValue(item.aspectRatio);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissItem(item.id);
  };

  return (
    <div
      className="relative rounded-lg overflow-hidden bg-zinc-900 animate-fade-in"
      style={{ aspectRatio }}
    >
      {/* Animated background */}
      {!isFailed && <SineWaveGrid />}

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

      {/* Content overlay for failed state */}
      {isFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-sm text-red-400 text-center line-clamp-3">
            {item.error || "Generation failed"}
          </p>
        </div>
      )}

      {/* Generating text overlay */}
      {!isFailed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-white/80 font-medium drop-shadow-lg">
            Generating...
          </p>
        </div>
      )}

      {/* Model badge */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white/90">
        {item.modelName}
      </div>
    </div>
  );
}
