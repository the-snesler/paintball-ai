import type { PointerEvent } from "react";
import type { CropHandle, Rect } from "./markupTypes";

interface CropBoxOverlayProps {
  cropDisplay: Rect;
  onPointerDown: (event: PointerEvent<HTMLDivElement>, handle: CropHandle) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerEnd: (event: PointerEvent) => void;
}

export function CropBoxOverlay({
  cropDisplay,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
}: CropBoxOverlayProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-black/45" />
      <div
        className="absolute border border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
        style={{
          left: cropDisplay.x,
          top: cropDisplay.y,
          width: cropDisplay.width,
          height: cropDisplay.height,
        }}
        onPointerDown={(event) => onPointerDown(event, "move")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <ThirdsGrid />
        <CropHandleButton
          handle="nw"
          className="-top-2 -left-2 h-4 w-4 cursor-nwse-resize rounded-full"
          onPointerDown={onPointerDown}
        />
        <CropHandleButton
          handle="ne"
          className="-top-2 -right-2 h-4 w-4 cursor-nesw-resize rounded-full"
          onPointerDown={onPointerDown}
        />
        <CropHandleButton
          handle="sw"
          className="-bottom-2 -left-2 h-4 w-4 cursor-nesw-resize rounded-full"
          onPointerDown={onPointerDown}
        />
        <CropHandleButton
          handle="se"
          className="-right-2 -bottom-2 h-4 w-4 cursor-nwse-resize rounded-full"
          onPointerDown={onPointerDown}
        />
        <CropHandleButton
          handle="n"
          className="-top-1 left-1/2 h-2 w-8 -translate-x-1/2 cursor-ns-resize rounded-sm"
          onPointerDown={onPointerDown}
        />
        <CropHandleButton
          handle="s"
          className="-bottom-1 left-1/2 h-2 w-8 -translate-x-1/2 cursor-ns-resize rounded-sm"
          onPointerDown={onPointerDown}
        />
        <CropHandleButton
          handle="w"
          className="top-1/2 -left-1 h-8 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm"
          onPointerDown={onPointerDown}
        />
        <CropHandleButton
          handle="e"
          className="top-1/2 -right-1 h-8 w-2 -translate-y-1/2 cursor-ew-resize rounded-sm"
          onPointerDown={onPointerDown}
        />
      </div>
    </>
  );
}

function ThirdsGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-3 grid-rows-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <div key={index} className="border border-white/30" />
      ))}
    </div>
  );
}

function CropHandleButton({
  handle,
  className,
  onPointerDown,
}: {
  handle: CropHandle;
  className: string;
  onPointerDown: (event: PointerEvent<HTMLDivElement>, handle: CropHandle) => void;
}) {
  return (
    <div
      className={`absolute z-20 rounded-full border border-black/60 bg-white ${className}`}
      onPointerDown={(event) => onPointerDown(event, handle)}
    />
  );
}
