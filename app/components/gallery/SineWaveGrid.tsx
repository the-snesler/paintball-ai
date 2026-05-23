import { useRef, useEffect } from "react";

interface SineWaveGridProps {
  frozen?: boolean;
  gridSize?: number;
  radius?: number;
  opacity?: number;
  maxCellSizePct?: number;
  sampleImageUrl?: string;
}

const TAU = Math.PI * 2;
const WAVE_COUNT = 6;
const PURPLE_WAVE_COUNT = 3;

export function SineWaveGrid({
  frozen = false,
  gridSize = 8,
  radius = 0,
  opacity = 1,
  maxCellSizePct = 1,
  sampleImageUrl,
}: SineWaveGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);
  const randsRef = useRef(new Array(PURPLE_WAVE_COUNT * 4 + WAVE_COUNT * 4).fill(0).map(() => Math.random()));
  const sampleDataRef = useRef<{
    data: Uint8ClampedArray;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    sampleDataRef.current = null;
    if (!sampleImageUrl) return;

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (cancelled) return;

      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) return;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(image, 0, 0, width, height);
      sampleDataRef.current = {
        data: ctx.getImageData(0, 0, width, height).data,
        width,
        height,
      };
    };

    image.src = sampleImageUrl;

    return () => {
      cancelled = true;
    };
  }, [sampleImageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const baseColor = frozen
      ? { r: 120, g: 120, b: 120 } // grey
      : { r: 138, g: 75, b: 207 }; // purple-500
    const rands = randsRef.current;


    function getWave(i: number, x: number, y: number, time: number) {
      if (i + 4 >= rands.length) return 0;
      // direction is a random angle in radians, frequency determines wave width, speed determines how fast the wave moves, phase determines the starting point
      const direction = rands[i] * TAU;
      const cycles = 0.1;
      const speed = rands[i + 2] * 2.5 + 0.2;
      const phase = rands[i + 3] * TAU;
      const projected = x * Math.cos(direction) + y * Math.sin(direction);
      return Math.sin(projected * TAU * cycles + time * speed + phase);
    }


    const sampleColor = (x: number, y: number, width: number, height: number) => {
      const sample = sampleDataRef.current;
      if (!sample) return null;

      const canvasRatio = width / height;
      const imageRatio = sample.width / sample.height;
      let imageX: number;
      let imageY: number;

      if (canvasRatio > imageRatio) {
        const visibleHeight = sample.width / canvasRatio;
        const yOffset = (sample.height - visibleHeight) / 2;
        imageX = (x / width) * sample.width;
        imageY = yOffset + (y / height) * visibleHeight;
      } else {
        const visibleWidth = sample.height * canvasRatio;
        const xOffset = (sample.width - visibleWidth) / 2;
        imageX = xOffset + (x / width) * visibleWidth;
        imageY = (y / height) * sample.height;
      }

      const clampedX = Math.min(sample.width - 1, Math.max(0, imageX));
      const clampedY = Math.min(sample.height - 1, Math.max(0, imageY));
      const x0 = Math.floor(clampedX);
      const y0 = Math.floor(clampedY);
      const x1 = Math.min(sample.width - 1, x0 + 1);
      const y1 = Math.min(sample.height - 1, y0 + 1);
      const tx = clampedX - x0;
      const ty = clampedY - y0;

      const readColor = (pixelX: number, pixelY: number) => {
        const index = (pixelY * sample.width + pixelX) * 4;
        return {
          r: sample.data[index],
          g: sample.data[index + 1],
          b: sample.data[index + 2],
        };
      };

      const topLeft = readColor(x0, y0);
      const topRight = readColor(x1, y0);
      const bottomLeft = readColor(x0, y1);
      const bottomRight = readColor(x1, y1);
      const top = {
        r: topLeft.r * (1 - tx) + topRight.r * tx,
        g: topLeft.g * (1 - tx) + topRight.g * tx,
        b: topLeft.b * (1 - tx) + topRight.b * tx,
      };
      const bottom = {
        r: bottomLeft.r * (1 - tx) + bottomRight.r * tx,
        g: bottomLeft.g * (1 - tx) + bottomRight.g * tx,
        b: bottomLeft.b * (1 - tx) + bottomRight.b * tx,
      };
      const r = top.r * (1 - ty) + bottom.r * ty;
      const g = top.g * (1 - ty) + bottom.g * ty;
      const b = top.b * (1 - ty) + bottom.b * ty;

      if (!frozen) return { r, g, b };

      const luminance = r * 0.299 + g * 0.587 + b * 0.114;
      return { r: luminance, g: luminance, b: luminance };
    };


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
      ctx.clearRect(0, 0, width, height);

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

          let combinedWave = 0;
          for (let i = 0; i < WAVE_COUNT; i++) {
            combinedWave += getWave(i * 4, col, row, timeRef.current);
          }
          combinedWave /= WAVE_COUNT; // average
          const normalizedWave = (combinedWave + 1) / 2; // 0 to 1

          const squareSize = Math.min(
            cellWidth,
            cellWidth * (rands[8] * 0.2 + normalizedWave * 0.4 + 0.4) * maxCellSizePct
          );
          const alpha = frozen ? normalizedWave * 0.5 : normalizedWave * 0.7 + rands[8] * 0.3; // dimmer when greyscale

          // Slight color shift based on wave (only for colored version)
          const hueShift = frozen ? 0 : normalizedWave * 30 - 15;
          let purpleCombinedWave = 0;
          for (let i = 0; i < PURPLE_WAVE_COUNT; i++) {
            purpleCombinedWave += getWave(i * 4 + WAVE_COUNT * 4, col, row, timeRef.current);
          }
          purpleCombinedWave /= PURPLE_WAVE_COUNT; // average

          const sampledColor = sampleColor(
            x + purpleCombinedWave * 4,
            y + purpleCombinedWave * 4,
            width,
            height
          );
          const purpleStrength = (purpleCombinedWave + 1) / 2;
          const purpleBlend = Math.min(0.45, Math.max(0, purpleStrength * 0.45));
          const sampledOrBase = sampledColor ?? baseColor;
          const color = {
            r: sampledOrBase.r * (1 - purpleBlend) + baseColor.r * purpleBlend,
            g: sampledOrBase.g * (1 - purpleBlend) + baseColor.g * purpleBlend,
            b: sampledOrBase.b * (1 - purpleBlend) + baseColor.b * purpleBlend,
          };
          const r = Math.min(255, Math.max(0, color.r + hueShift));
          const g = Math.min(255, Math.max(0, color.g - (frozen ? 0 : hueShift * 0.5)));
          const b = color.b;

          ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

          // Draw rounded square
          const halfSize = squareSize / 2;
          ctx.beginPath();
          ctx.roundRect(x - halfSize, y - halfSize, squareSize * aspectRatio, squareSize, radius);
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
  }, [frozen, gridSize, maxCellSizePct, radius, sampleImageUrl]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full blur-sm"
      style={{ imageRendering: "pixelated", opacity }}
    />
  );
}
