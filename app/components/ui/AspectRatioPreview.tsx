export function AspectRatioPreview({
  width,
  height,
  isSelected = false,
  maxDim = 20,
}: {
  width: number;
  height: number;
  isSelected?: boolean;
  maxDim?: number;
}) {
  const scale = maxDim / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  return (
    <div
      className={`rounded-sm border-2 ${
        isSelected ? "border-purple-500 bg-purple-500/20" : "border-c-border"
      }`}
      style={{ width: `${w}px`, height: `${h}px` }}
    />
  );
}
