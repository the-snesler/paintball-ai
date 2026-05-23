import { ArrowUp, Brush, Check, Crop, Eraser, Expand, RotateCcw, Undo2 } from "lucide-react";
import { AspectRatioPreview } from "~/components/ui/AspectRatioPreview";
import type { RatioOption, Tool } from "./markupTypes";
import type { ReactNode } from "react";

interface ReferenceMarkupToolbarProps {
  tool: Tool;
  color: string;
  colors: string[];
  brushSizes: number[];
  brushSizeIndex: number;
  aspectLock: string;
  ratioOptions: RatioOption[];
  canUndo: boolean;
  isApplying: boolean;
  onToolSelect: (tool: Tool) => void;
  onColorSelect: (color: string) => void;
  onBrushSizeSelect: (index: number) => void;
  onRatioSelect: (ratio: string) => void;
  onUndo: () => void;
  onReset: () => void;
  onCancel: () => void;
  onApply: () => void;
  onUse: () => void;
}

export function ReferenceMarkupToolbar({
  tool,
  color,
  colors,
  brushSizes,
  brushSizeIndex,
  aspectLock,
  ratioOptions,
  canUndo,
  isApplying,
  onToolSelect,
  onColorSelect,
  onBrushSizeSelect,
  onRatioSelect,
  onUndo,
  onReset,
  onCancel,
  onApply,
  onUse,
}: ReferenceMarkupToolbarProps) {
  const toolButton = (value: Tool, label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => onToolSelect(value)}
      className={`flex h-9 items-center gap-2 rounded-lg px-3 text-xs transition-colors ${
        tool === value
          ? "bg-purple-600 text-white"
          : "bg-surface-overlay text-text-secondary hover:bg-surface-interactive"
      }`}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="border-border-subtle bg-surface-raised/95 flex shrink-0 flex-col gap-3 border-t p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {toolButton("brush", "Brush", <Brush className="h-4 w-4" />)}
          {toolButton("eraser", "Erase", <Eraser className="h-4 w-4" />)}
          {toolButton("crop", "Crop", <Crop className="h-4 w-4" />)}
          {toolButton("outpaint", "Outpaint", <Expand className="h-4 w-4" />)}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="bg-surface-overlay text-text-secondary hover:bg-surface-interactive flex h-9 items-center gap-2 rounded-lg px-3 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
            Undo
          </button>
          <button
            type="button"
            onClick={onReset}
            className="bg-surface-overlay text-text-secondary hover:bg-surface-interactive flex h-9 items-center gap-2 rounded-lg px-3 text-xs transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="bg-surface-overlay text-text-secondary hover:bg-surface-interactive h-9 rounded-lg px-3 text-xs transition-colors"
          >
            Cancel
          </button>
          {(tool === "crop" || tool === "outpaint") && (
            <button
              type="button"
              onClick={onApply}
              disabled={isApplying}
              className="flex h-9 items-center gap-2 rounded-lg bg-purple-600 px-3 text-xs font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              Apply
            </button>
          )}
          <button
            type="button"
            onClick={onUse}
            disabled={isApplying}
            className="flex h-9 items-center gap-2 rounded-lg bg-purple-600 px-3 text-xs font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowUp className="h-4 w-4" />
            {isApplying ? "Using..." : "Use"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {(tool === "brush" || tool === "eraser") && (
          <>
            {tool === "brush" && (
              <div className="flex items-center gap-1.5">
                {colors.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => onColorSelect(swatch)}
                    className={`h-6 w-6 rounded-full border transition-transform ${
                      color === swatch
                        ? "scale-110 border-white"
                        : "border-white/20 hover:scale-105"
                    }`}
                    style={{ backgroundColor: swatch }}
                    title={swatch}
                  />
                ))}
              </div>
            )}
            <label className="text-text-tertiary flex items-center gap-2 text-xs">
              Size
              <div className="flex items-center gap-1">
                {brushSizes.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onBrushSizeSelect(index)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                      brushSizeIndex === index
                        ? "border-purple-500 bg-purple-500/20"
                        : "border-c-border bg-surface-overlay text-text-tertiary hover:bg-surface-interactive"
                    }`}
                    title={`Brush size ${index + 1}`}
                  >
                    <span
                      className="rounded-full border border-dashed"
                      style={{
                        width: `${8 + index * 3}px`,
                        height: `${8 + index * 3}px`,
                        borderColor: brushSizeIndex === index ? "#c4b5fd" : "currentColor",
                      }}
                    />
                  </button>
                ))}
              </div>
            </label>
          </>
        )}

        {(tool === "crop" || tool === "outpaint") && (
          <div className="flex max-w-full flex-nowrap gap-1.5 overflow-x-auto pb-1">
            {ratioOptions.map((ratio) => (
              <button
                key={ratio.value}
                type="button"
                onClick={() => onRatioSelect(ratio.value)}
                className={`flex h-14 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border p-1.5 transition-colors ${
                  aspectLock === ratio.value
                    ? "border-purple-500 bg-purple-500/20"
                    : "border-c-border bg-surface-overlay hover:bg-surface-interactive"
                }`}
                title={ratio.label}
              >
                <AspectRatioPreview
                  width={ratio.width}
                  height={ratio.height}
                  maxDim={22}
                  isSelected={aspectLock === ratio.value}
                />
                <span className="text-text-tertiary text-[10px]">{ratio.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
