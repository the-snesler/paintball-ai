export type Tool = "brush" | "eraser" | "crop" | "outpaint";

export type CropHandle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Snapshot {
  imageData: ImageData;
  cropRect: Rect;
}

export interface RatioOption {
  value: string;
  label: string;
  width: number;
  height: number;
}

export const MIN_CROP_SIZE = 24;
