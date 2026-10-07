export function AspectRatioPreview({
  width,
  height,
  variant = "default",
  maxDim = 20,
}: {
  width: number;
  height: number;
  variant?: "default" | "highlighted" | "icon";
  isSelected?: boolean;
  maxDim?: number;
}) {
  const scale = maxDim / Math.max(width, height);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const variants = {
    highlighted: "border-purple-500 bg-purple-500/20 border-2 rounded-sm",
    default: "border-c-border border-2 rounded-sm",
    icon: "border-text-tertiary border rounded-xs",
  };

  return <div className={variants[variant]} style={{ width: `${w}px`, height: `${h}px` }} />;
}
