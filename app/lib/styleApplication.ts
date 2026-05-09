import type { StoredCharacter, StoredStyle } from "~/types";

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

export interface AppliedAdditions {
  /** Final prompt: user → character text → style text */
  prompt: string;
  styleHasReferenceImage: boolean;
  characterReferenceCount: number;
}

/**
 * Append character text and style text to the prompt.
 * Order: user → character[0].text → ... → character[N].text → style.text
 * Style {n} resolves to currentReferenceCount + 1 (style sits right after existing refs).
 */
export function applyPromptAdditions(
  prompt: string,
  characters: StoredCharacter[],
  style: StoredStyle | null,
  currentReferenceCount: number
): AppliedAdditions {
  let result = prompt.trimEnd();

  for (const character of characters) {
    const text = character.text.trim();
    if (!text) continue;
    const sep = result.length > 0 ? "\n\n" : "";
    result = `${result}${sep}Character: ${text}`;
  }

  const styleHasImage = Boolean(style?.referenceImageId);
  const styleImagePosition = currentReferenceCount + 1;

  if (style?.text) {
    const resolvedStyleText = styleHasImage
      ? style.text.replaceAll("{n}", String(styleImagePosition))
      : style.text.replaceAll("{n}", "");
    if (resolvedStyleText.trim()) {
      const sep = result.length > 0 ? "\n\n" : "";
      result = `${result}${sep}Style: ${resolvedStyleText.trim()}`;
    }
  }

  const characterReferenceCount = characters.reduce(
    (sum, c) => sum + c.referenceImageIds.length,
    0
  );

  return {
    prompt: result.trim(),
    styleHasReferenceImage: styleHasImage,
    characterReferenceCount,
  };
}
