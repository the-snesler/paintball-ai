import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ASPECT_RATIOS, parseAspectRatio } from "~/lib/models";
import type { ReferenceImage } from "~/types";
import { CropBoxOverlay } from "./CropBoxOverlay";
import { ReferenceMarkupToolbar } from "./ReferenceMarkupToolbar";
import {
  constrainCropRect,
  getUnionRect,
  normalizeCropRect,
  resizeCropRect,
} from "./markupGeometry";
import type { CropHandle, Rect, Snapshot, Tool } from "./markupTypes";
import { MIN_CROP_SIZE } from "./markupTypes";
import type { PointerEvent } from "react";

interface ReferenceImageMarkupOverlayProps {
  image: ReferenceImage;
  onClose: () => void;
  onApply: (image: Omit<ReferenceImage, "id">) => void;
}

const COLORS = ["#ffffff", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#a855f7", "#111827"];
const EXTRA_RATIOS = ["3:2", "2:3"];

export function ReferenceImageMarkupOverlay({
  image,
  onClose,
  onApply,
}: ReferenceImageMarkupOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const undoStackRef = useRef<Snapshot[]>([]);
  const pointerRef = useRef<{
    kind: "draw" | "crop";
    pointerId: number;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    startRect: Rect;
    handle?: CropHandle;
  } | null>(null);

  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(COLORS[1]);
  const [brushSizeIndex, setBrushSizeIndex] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [cropRect, setCropRect] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const [aspectLock, setAspectLock] = useState("free");
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [canUndo, setCanUndo] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const ratioOptions = useMemo(
    () => [
      { value: "free", label: "Free", width: 1, height: 1 },
      {
        value: "original",
        label: "Original",
        width: Math.max(1, dimensions.width),
        height: Math.max(1, dimensions.height),
      },
      ...ASPECT_RATIOS,
      ...EXTRA_RATIOS.map((ratio) => {
        const parsed = parseAspectRatio(ratio);
        return { value: ratio, label: ratio, width: parsed.width, height: parsed.height };
      }),
    ],
    [dimensions.height, dimensions.width]
  );

  const longEnd = Math.max(dimensions.width, dimensions.height, 1);
  const brushSizes = useMemo(() => {
    const min = Math.max(1, Math.round(longEnd * 0.01));
    const max = Math.max(min + 5, Math.round(longEnd / 6));
    return Array.from({ length: 6 }, (_, index) => Math.round(min + ((max - min) * index) / 5));
  }, [longEnd]);
  const brushSize = brushSizes[brushSizeIndex] ?? brushSizes[0] ?? 4;

  const originalRatio = dimensions.height > 0 ? dimensions.width / dimensions.height : 1;
  const lockedRatio = useMemo(() => {
    if (aspectLock === "free") return null;
    if (aspectLock === "original") return originalRatio;
    const parsed = parseAspectRatio(aspectLock);
    return parsed.width / parsed.height;
  }, [aspectLock, originalRatio]);

  const display = useMemo(() => {
    if (!dimensions.width || !dimensions.height || !stageSize.width || !stageSize.height) {
      return { scale: 1, x: 0, y: 0, width: dimensions.width, height: dimensions.height };
    }
    const padding = 48;
    const availableWidth = Math.max(1, stageSize.width - padding);
    const availableHeight = Math.max(1, stageSize.height - padding);
    const view =
      tool === "outpaint"
        ? getUnionRect(cropRect, { x: 0, y: 0, width: dimensions.width, height: dimensions.height })
        : { x: 0, y: 0, width: dimensions.width, height: dimensions.height };
    const baseImageScale = Math.min(
      availableWidth / dimensions.width,
      availableHeight / dimensions.height,
      1
    );
    const maxScale = tool === "outpaint" ? baseImageScale * 0.5 : baseImageScale;
    const scale = Math.min(maxScale, availableWidth / view.width, availableHeight / view.height);
    const width = dimensions.width * scale;
    const height = dimensions.height * scale;
    const viewLeft = (stageSize.width - view.width * scale) / 2;
    const viewTop = (stageSize.height - view.height * scale) / 2;
    return {
      scale,
      width,
      height,
      x: viewLeft - view.x * scale,
      y: viewTop - view.y * scale,
    };
  }, [cropRect, dimensions, stageSize, tool]);

  const cropDisplay = {
    x: display.x + cropRect.x * display.scale,
    y: display.y + cropRect.y * display.scale,
    width: cropRect.width * display.scale,
    height: cropRect.height * display.scale,
  };

  const drawCanvas = useCallback((source?: CanvasImageSource) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (source) ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }, []);

  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    undoStackRef.current = [
      ...undoStackRef.current.slice(-14),
      { imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), cropRect },
    ];
    setCanUndo(true);
  }, [cropRect]);

  const canvasPointFromEvent = useCallback(
    (event: PointerEvent): { x: number; y: number } | null => {
      if (!stageRef.current || !display.scale) return null;
      const rect = stageRef.current.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left - display.x) / display.scale,
        y: (event.clientY - rect.top - display.y) / display.scale,
      };
    },
    [display]
  );

  const strokeTo = useCallback(
    (fromX: number, fromY: number, toX: number, toY: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = brushSize;
      if (tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
      }
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.restore();
    },
    [brushSize, color, tool]
  );

  useEffect(() => {
    let cancelled = false;
    void createImageBitmap(image.blob).then((bitmap) => {
      if (cancelled) {
        bitmap.close();
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      setDimensions({ width: bitmap.width, height: bitmap.height });
      setCropRect({ x: 0, y: 0, width: bitmap.width, height: bitmap.height });
      undoStackRef.current = [];
      setCanUndo(false);
      drawCanvas(bitmap);
      bitmap.close();
    });
    return () => {
      cancelled = true;
    };
  }, [drawCanvas, image.blob]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      setStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const applyRatio = useCallback(
    (nextRatio: string) => {
      setAspectLock(nextRatio);
      const ratio =
        nextRatio === "free"
          ? null
          : nextRatio === "original"
            ? originalRatio
            : parseAspectRatio(nextRatio).width / parseAspectRatio(nextRatio).height;
      if (!ratio) return;
      setCropRect((rect) => {
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        let width = rect.width;
        let height = width / ratio;
        if (height > rect.height) {
          height = rect.height;
          width = height * ratio;
        }
        const next = {
          x: centerX - width / 2,
          y: centerY - height / 2,
          width: Math.max(MIN_CROP_SIZE, width),
          height: Math.max(MIN_CROP_SIZE, height),
        };
        return constrainCropRect(next, tool, dimensions, ratio);
      });
    },
    [dimensions, originalRatio, tool]
  );

  const selectTool = (nextTool: Tool) => {
    setTool(nextTool);
    if (nextTool === "crop" || nextTool === "outpaint") {
      setCropRect((rect) => constrainCropRect(rect, nextTool, dimensions, lockedRatio));
    }
  };

  const handleCanvasPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (tool === "crop" || tool === "outpaint") return;
    const point = canvasPointFromEvent(event);
    if (!point) return;
    pushUndo();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = {
      kind: "draw",
      pointerId: event.pointerId,
      lastX: point.x,
      lastY: point.y,
      startX: point.x,
      startY: point.y,
      startRect: cropRect,
    };
    strokeTo(point.x, point.y, point.x + 0.01, point.y + 0.01);
  };

  const handleCanvasPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const active = pointerRef.current;
    if (!active || active.kind !== "draw" || active.pointerId !== event.pointerId) return;
    const point = canvasPointFromEvent(event);
    if (!point) return;
    strokeTo(active.lastX, active.lastY, point.x, point.y);
    active.lastX = point.x;
    active.lastY = point.y;
  };

  const endPointer = (event: PointerEvent) => {
    if (pointerRef.current?.pointerId === event.pointerId) {
      pointerRef.current = null;
    }
  };

  const handleCropPointerDown = (event: PointerEvent<HTMLDivElement>, handle: CropHandle) => {
    if (tool !== "crop" && tool !== "outpaint") return;
    event.preventDefault();
    event.stopPropagation();
    pushUndo();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPointFromEvent(event);
    if (!point) return;
    pointerRef.current = {
      kind: "crop",
      pointerId: event.pointerId,
      lastX: point.x,
      lastY: point.y,
      startX: point.x,
      startY: point.y,
      startRect: cropRect,
      handle,
    };
  };

  const handleCropPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = pointerRef.current;
    if (!active || active.kind !== "crop" || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = canvasPointFromEvent(event);
    if (!point) return;
    const dx = point.x - active.startX;
    const dy = point.y - active.startY;
    setCropRect(
      constrainCropRect(
        normalizeCropRect(
          resizeCropRect(active.startRect, active.handle ?? "move", dx, dy, lockedRatio)
        ),
        tool,
        dimensions,
        lockedRatio
      )
    );
  };

  const handleUndo = () => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.putImageData(snapshot.imageData, 0, 0);
    setCropRect(snapshot.cropRect);
    setCanUndo(undoStackRef.current.length > 0);
  };

  const handleReset = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    pushUndo();
    void createImageBitmap(image.blob).then((bitmap) => {
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      setDimensions({ width: bitmap.width, height: bitmap.height });
      setCropRect({ x: 0, y: 0, width: bitmap.width, height: bitmap.height });
      drawCanvas(bitmap);
      bitmap.close();
    });
  };

  const cropWorkingCanvas = useCallback((): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const width = Math.max(1, Math.round(cropRect.width));
    const height = Math.max(1, Math.round(cropRect.height));
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const ctx = output.getContext("2d");
    if (!ctx) return false;

    const srcX = Math.max(0, cropRect.x);
    const srcY = Math.max(0, cropRect.y);
    const srcRight = Math.min(canvas.width, cropRect.x + cropRect.width);
    const srcBottom = Math.min(canvas.height, cropRect.y + cropRect.height);
    const srcWidth = Math.max(0, srcRight - srcX);
    const srcHeight = Math.max(0, srcBottom - srcY);
    if (srcWidth > 0 && srcHeight > 0) {
      ctx.drawImage(
        canvas,
        srcX,
        srcY,
        srcWidth,
        srcHeight,
        srcX - cropRect.x,
        srcY - cropRect.y,
        srcWidth,
        srcHeight
      );
    }

    pushUndo();
    canvas.width = width;
    canvas.height = height;
    setDimensions({ width, height });
    setCropRect({ x: 0, y: 0, width, height });
    drawCanvas(output);
    return true;
  }, [cropRect, drawCanvas, pushUndo]);

  const handleApplyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (tool === "crop" || tool === "outpaint") {
      cropWorkingCanvas();
    }
  };

  const handleUse = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsApplying(true);
    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    const ctx = output.getContext("2d");
    if (!ctx) {
      setIsApplying(false);
      return;
    }
    ctx.drawImage(canvas, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
    if (!blob) {
      setIsApplying(false);
      return;
    }

    onApply({
      blob,
      url: URL.createObjectURL(blob),
      name: pngName(image.name),
      sourceGalleryItemId: image.sourceGalleryItemId,
    });
    setIsApplying(false);
    onClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="border-border-subtle flex h-14 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-text-primary truncate text-sm font-medium">Edit reference</h2>
          <span className="text-text-muted hidden truncate text-xs sm:block">{image.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-surface-raised/80 hover:bg-surface-overlay rounded-lg p-2 transition-colors"
            title="Close"
          >
            <X className="text-text-secondary h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto]">
        <div ref={stageRef} className="relative m-4 min-h-0 overflow-hidden rounded-lg">
          {tool === "outpaint" && dimensions.width > 0 && (
            <div
              className="bg-checkered pointer-events-none absolute"
              style={{
                left: cropDisplay.x,
                top: cropDisplay.y,
                width: cropDisplay.width,
                height: cropDisplay.height,
              }}
            />
          )}
          <canvas
            ref={canvasRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            className={`bg-checkered-black absolute ${
              tool === "crop" || tool === "outpaint" ? "cursor-default" : "cursor-crosshair"
            }`}
            style={{
              left: display.x,
              top: display.y,
              width: display.width,
              height: display.height,
            }}
          />

          {(tool === "crop" || tool === "outpaint") && dimensions.width > 0 && (
            <CropBoxOverlay
              cropDisplay={cropDisplay}
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerEnd={endPointer}
            />
          )}
        </div>

        <ReferenceMarkupToolbar
          tool={tool}
          color={color}
          colors={COLORS}
          brushSizes={brushSizes}
          brushSizeIndex={brushSizeIndex}
          aspectLock={aspectLock}
          ratioOptions={ratioOptions}
          canUndo={canUndo}
          isApplying={isApplying}
          onToolSelect={selectTool}
          onColorSelect={setColor}
          onBrushSizeSelect={setBrushSizeIndex}
          onRatioSelect={applyRatio}
          onUndo={handleUndo}
          onReset={handleReset}
          onCancel={onClose}
          onApply={handleApplyCrop}
          onUse={() => void handleUse()}
        />
      </div>
    </div>,
    document.body
  );
}

function pngName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "reference"}-edited.png`;
}
