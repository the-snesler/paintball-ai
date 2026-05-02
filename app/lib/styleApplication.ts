import type { StoredStyle } from "~/types";

export interface AppliedStyle {
  prompt: string;
  appendsReferenceImage: boolean;
}

export function applyStyle(
  prompt: string,
  style: StoredStyle | null | undefined,
  existingReferenceCount: number
): AppliedStyle {
  if (!style) return { prompt, appendsReferenceImage: false };

  const hasImage = Boolean(style.referenceImageId);
  const styleImagePosition = existingReferenceCount + 1;

  const resolvedText = hasImage
    ? style.text.replaceAll("{n}", String(styleImagePosition))
    : style.text.replaceAll("{n}", "");

  const trimmedPrompt = prompt.trimEnd();
  const separator = trimmedPrompt.length > 0 ? "\n\n" : "";
  return {
    prompt: `${trimmedPrompt}${separator}${resolvedText}`.trim(),
    appendsReferenceImage: hasImage,
  };
}
