import type { Rect, Tool } from "./markupTypes";
import { MIN_CROP_SIZE, type CropHandle } from "./markupTypes";

export function resizeCropRect(
  rect: Rect,
  handle: CropHandle,
  dx: number,
  dy: number,
  ratio: number | null
): Rect {
  if (handle === "move") {
    return { ...rect, x: rect.x + dx, y: rect.y + dy };
  }

  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;

  if (handle.includes("w")) left += dx;
  if (handle.includes("e")) right += dx;
  if (handle.includes("n")) top += dy;
  if (handle.includes("s")) bottom += dy;

  const next = normalizeCropRect({ x: left, y: top, width: right - left, height: bottom - top });
  if (!ratio) return next;

  const anchorX = handle.includes("w") ? right : left;
  const anchorY = handle.includes("n") ? bottom : top;
  const signX = handle.includes("w") ? -1 : 1;
  const signY = handle.includes("n") ? -1 : 1;
  const widthFromPointer = Math.max(MIN_CROP_SIZE, Math.abs(next.width));
  const heightFromPointer = Math.max(MIN_CROP_SIZE, Math.abs(next.height));

  if (handle === "n" || handle === "s") {
    next.height = heightFromPointer;
    next.width = next.height * ratio;
  } else {
    next.width = widthFromPointer;
    next.height = next.width / ratio;
  }

  next.x = signX < 0 ? anchorX - next.width : anchorX;
  next.y = signY < 0 ? anchorY - next.height : anchorY;
  return next;
}

export function normalizeCropRect(rect: Rect): Rect {
  let { x, y, width, height } = rect;
  if (width < 0) {
    x += width;
    width = Math.abs(width);
  }
  if (height < 0) {
    y += height;
    height = Math.abs(height);
  }
  return {
    x,
    y,
    width: Math.max(MIN_CROP_SIZE, width),
    height: Math.max(MIN_CROP_SIZE, height),
  };
}

export function constrainCropRect(
  rect: Rect,
  tool: Tool,
  dimensions: { width: number; height: number },
  ratio?: number | null
): Rect {
  const normalized = normalizeCropRect(rect);
  if (!dimensions.width || !dimensions.height) return normalized;

  if (tool === "crop") {
    const width = Math.min(normalized.width, dimensions.width);
    const height = Math.min(normalized.height, dimensions.height);
    return {
      x: clamp(normalized.x, 0, dimensions.width - width),
      y: clamp(normalized.y, 0, dimensions.height - height),
      width,
      height,
    };
  }

  if (tool === "outpaint") {
    const left = Math.min(0, normalized.x);
    const top = Math.min(0, normalized.y);
    const right = Math.max(dimensions.width, normalized.x + normalized.width);
    const bottom = Math.max(dimensions.height, normalized.y + normalized.height);
    const contained = {
      x: left,
      y: top,
      width: Math.max(MIN_CROP_SIZE, right - left),
      height: Math.max(MIN_CROP_SIZE, bottom - top),
    };
    return ratio ? expandRectToRatio(contained, ratio, dimensions) : contained;
  }

  return normalized;
}

export function expandRectToRatio(
  rect: Rect,
  ratio: number,
  dimensions: { width: number; height: number }
): Rect {
  const currentRatio = rect.width / rect.height;
  if (Math.abs(currentRatio - ratio) < 0.001) return rect;

  if (currentRatio > ratio) {
    const height = rect.width / ratio;
    const targetY = rect.y + rect.height / 2 - height / 2;
    return {
      ...rect,
      y: clamp(targetY, dimensions.height - height, 0),
      height,
    };
  }

  const width = rect.height * ratio;
  const targetX = rect.x + rect.width / 2 - width / 2;
  return {
    ...rect,
    x: clamp(targetX, dimensions.width - width, 0),
    width,
  };
}

export function getUnionRect(a: Rect, b: Rect): Rect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
