import { useRef, useEffect } from "react";

interface SineWaveGridProps {
  frozen?: boolean;
  gridSize?: number;
  radius?: number;
  opacity?: number;
  maxCellSizePct?: number;
  backgroundColor?: string;
}

export function SineWaveGrid({
  frozen = false,
  gridSize = 8,
  radius = 0,
  opacity = 1,
  maxCellSizePct = 1.3,
  backgroundColor = "#18181b",
}: SineWaveGridProps) {
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
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Calculate cell size based on canvas dimensions
      const cols = gridSize;
      const rows = Math.ceil((height / width) * gridSize) || gridSize;
      const cellWidth = width / cols;
      const cellHeight = height / rows;
      const aspectRatio = cellWidth / cellHeight;

      // Draw grid of animated squares
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * cellWidth + cellWidth / 2;
          const y = row * cellHeight + cellHeight / 2;

          // Multiple sine waves for more interesting pattern
          const wave1 = Math.sin(col * 0.5 + timeRef.current * 2.0);
          const wave2 = Math.sin(row * rand1 + timeRef.current * 1.5);
          const wave3 = Math.sin((col * rand2 + row * rand3) * 0.4 + timeRef.current * 2.5);
          const wave4 = Math.sin(
            Math.sqrt(col * col + row * row) * 0.4 - timeRef.current * 1.8 + rand4 * 10
          );

          const combinedWave = (wave1 + wave2 + wave3 + wave4) / 4;
          const normalizedWave = (combinedWave + 1) / 2; // 0 to 1

          const width = Math.min(
            cellWidth,
            cellWidth * (0.3 + normalizedWave * 0.7) * maxCellSizePct
          );
          const alpha = frozen ? normalizedWave * 0.5 : normalizedWave; // dimmer when greyscale

          // Slight color shift based on wave (only for colored version)
          const hueShift = frozen ? 0 : normalizedWave * 30 - 15;
          const r = Math.min(255, Math.max(0, baseColor.r + hueShift));
          const g = Math.min(255, Math.max(0, baseColor.g - (frozen ? 0 : hueShift * 0.5)));
          const b = baseColor.b;

          ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

          // Draw rounded square
          const halfSize = width / 2;
          ctx.beginPath();
          ctx.roundRect(x - halfSize, y - halfSize, width * aspectRatio, width, radius);
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
      className="absolute inset-0 h-full w-full blur-sm"
      style={{ imageRendering: "pixelated", opacity }}
    />
  );
}
