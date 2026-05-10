import type { StoredCharacter, StoredStyle } from "~/types";
import { UNIFY_PROMPT_SYSTEM } from "~/lib/prompts";
import { callTextModel, isTextModelAvailable } from "~/lib/textModel";

interface BlockContextOptions {
  prompt: string;
  characters: StoredCharacter[];
  style: StoredStyle | null | undefined;
  styleImagePosition?: number;
}

/** Escape regex metacharacters so a name can be embedded in a RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word case-insensitive match for a bare character name. */
function bareNameRegex(name: string, flags: string): RegExp {
  return new RegExp(`(?<!\\w)${escapeRegex(name)}(?!\\w)`, flags);
}

/** Resolve `{n}` in style text to the style image's position, or strip if no image. */
function resolveStyleText(style: StoredStyle, styleImagePosition: number | undefined): string {
  if (style.referenceImageId && styleImagePosition !== undefined) {
    return style.text.replaceAll("{n}", String(styleImagePosition));
  }
  return style.text.replaceAll("{n}", "");
}

/**
 * Build the user-message string passed to the elaboration / unification LLM,
 * exposing the character roster and style as labelled blocks. Falls back to
 * the bare prompt when no characters or style are present.
 */
export function buildElaborationContext({
  prompt,
  characters,
  style,
  styleImagePosition,
}: BlockContextOptions): string {
  const parts: string[] = [];

  const namedCharacters = characters.filter((c) => c.name.trim() && c.text.trim());
  if (namedCharacters.length > 0) {
    const lines = namedCharacters.map((c) => `- ${c.name.trim()}: ${c.text.trim()}`);
    parts.push(`## Characters\n${lines.join("\n")}`);
  }

  if (style?.text.trim()) {
    const resolved = resolveStyleText(style, styleImagePosition).trim();
    if (resolved) parts.push(`## Style\n${resolved}`);
  }

  if (parts.length === 0) return prompt;

  parts.push(`## Prompt\n${prompt}`);
  return parts.join("\n\n");
}

interface UnifyOptions {
  prompt: string;
  characters: StoredCharacter[];
  style: StoredStyle | null | undefined;
  /** Position (1-indexed) of the style reference image in the final ref list, if any. */
  styleImagePosition?: number;
}

/**
 * Produce the final image-generation prompt by integrating character
 * descriptions and style into the prompt. When characters are present we
 * route through the LLM for natural prose integration (image models follow
 * inline parentheticals poorly). Deterministic substitution is used only as
 * a fallback when the text model is unavailable or the LLM call fails, and
 * for the style-only case where no integration is needed.
 */
export async function unifyPrompt({
  prompt,
  characters,
  style,
  styleImagePosition,
}: UnifyOptions): Promise<string> {
  const namedCharacters = characters.filter((c) => c.name.trim() && c.text.trim());
  const hasStyle = Boolean(style?.text.trim());

  if (namedCharacters.length === 0 && !hasStyle) return prompt;

  if (namedCharacters.length === 0) {
    return deterministicUnify({ prompt, characters: [], style, styleImagePosition });
  }

  if (isTextModelAvailable()) {
    try {
      const context = buildElaborationContext({
        prompt,
        characters: namedCharacters,
        style,
        styleImagePosition,
      });
      const result = await callTextModel(UNIFY_PROMPT_SYSTEM, context);
      const trimmed = result.trim();
      if (trimmed) return trimmed;
    } catch {
      // Fall through to deterministic fallback
    }
  }

  return deterministicUnify({ prompt, characters: namedCharacters, style, styleImagePosition });
}

function deterministicUnify({
  prompt,
  characters,
  style,
  styleImagePosition,
}: {
  prompt: string;
  characters: StoredCharacter[];
  style: StoredStyle | null | undefined;
  styleImagePosition?: number;
}): string {
  let result = prompt.trimEnd();
  const substituted = new Set<string>();

  for (const character of characters) {
    const name = character.name.trim();
    const text = character.text.trim();
    if (!name || !text) continue;

    const re = bareNameRegex(name, "i");
    if (re.test(result)) {
      result = result.replace(re, `${name} (${text})`);
      substituted.add(character.id);
    }
  }

  for (const character of characters) {
    if (substituted.has(character.id)) continue;
    const text = character.text.trim();
    if (!text) continue;
    const sep = result.length > 0 ? "\n\n" : "";
    const label = character.name.trim() || "Character";
    result = `${result}${sep}${label}: ${text}`;
  }

  if (style?.text.trim()) {
    const resolved = resolveStyleText(style, styleImagePosition).trim();
    if (resolved) {
      const sep = result.length > 0 ? "\n\n" : "";
      result = `${result}${sep}Style: ${resolved}`;
    }
  }

  return result.trim();
}
