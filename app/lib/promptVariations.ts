import { callTextModel, resolveTextModelProvider } from "./textModel";
import { VARIATION_SYSTEM } from "./prompts";
import type { GalleryItem } from "~/types";

const VARIATION_PATTERN = /\{\{(.+?)\}\}/g;

export interface VariationSection {
  fullMatch: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

export function parseVariationSections(prompt: string): VariationSection[] {
  const sections: VariationSection[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex since we reuse the regex
  VARIATION_PATTERN.lastIndex = 0;

  while ((match = VARIATION_PATTERN.exec(prompt)) !== null) {
    sections.push({
      fullMatch: match[0],
      content: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return sections;
}

export function hasVariationSections(prompt: string): boolean {
  VARIATION_PATTERN.lastIndex = 0;
  return VARIATION_PATTERN.test(prompt);
}

/**
 * Extract the example text from a variation section content.
 * "sunset: vary time of day" -> "sunset"
 * "a red dress" -> "a red dress" (no colon, use entire content)
 */
function getExampleText(content: string): string {
  const colonIndex = content.indexOf(":");
  if (colonIndex === -1) return content.trim();
  return content.slice(0, colonIndex).trim();
}

/**
 * Build N varied prompts by replacing each section with its corresponding variation.
 * replacements[sectionIndex][variationIndex] = replacement string
 */
export function buildVariedPrompts(
  prompt: string,
  sections: VariationSection[],
  replacements: string[][]
): string[] {
  const count = replacements[0].length;
  const prompts: string[] = [];

  for (let i = 0; i < count; i++) {
    let result = prompt;
    // Replace right-to-left to preserve indices
    for (let k = sections.length - 1; k >= 0; k--) {
      const section = sections[k];
      result =
        result.slice(0, section.startIndex) + replacements[k][i] + result.slice(section.endIndex);
    }
    prompts.push(result);
  }

  return prompts;
}

/**
 * Extract per-section replacements from a (basePrompt, prompt) pair by building a regex
 * from the basePrompt that captures the text occupying each {{...}} slot. Returns null if
 * the match is ambiguous or fails (e.g. adjacent sections with no literal separator).
 */
export function extractReplacementsFromPair(
  basePrompt: string,
  prompt: string
): string[] | null {
  const sections = parseVariationSections(basePrompt);
  if (sections.length === 0) return null;

  // Reject adjacent sections — "(.*?)(.*?)" is fundamentally ambiguous.
  for (let i = 1; i < sections.length; i++) {
    if (sections[i].startIndex === sections[i - 1].endIndex) return null;
  }

  let pattern = "^";
  let cursor = 0;
  for (const section of sections) {
    pattern += escapeRegExp(basePrompt.slice(cursor, section.startIndex));
    pattern += "([\\s\\S]*?)";
    cursor = section.endIndex;
  }
  pattern += escapeRegExp(basePrompt.slice(cursor));
  pattern += "$";

  const match = prompt.match(new RegExp(pattern));
  if (!match) return null;
  return match.slice(1, sections.length + 1);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Collect per-section avoid-lists for a current prompt by scanning past gallery items
 * whose basePrompt exactly matches. Uses stored replacements when present; falls back
 * to regex extraction for legacy items. Returns null if no sections or no hits.
 */
export function collectAvoidList(
  currentPrompt: string,
  items: GalleryItem[]
): string[][] | null {
  const sections = parseVariationSections(currentPrompt);
  if (sections.length === 0) return null;

  const key = currentPrompt.trim();
  const avoid: string[][] = sections.map(() => []);
  const seen: Set<string>[] = sections.map(() => new Set());

  for (const item of items) {
    if (!item.basePrompt || item.basePrompt.trim() !== key) continue;

    let replacements: string[] | null = null;
    if (item.variationReplacements?.length === sections.length) {
      replacements = item.variationReplacements;
    } else {
      replacements = extractReplacementsFromPair(item.basePrompt, item.prompt);
    }
    if (!replacements || replacements.length !== sections.length) continue;

    for (let i = 0; i < sections.length; i++) {
      const value = replacements[i].trim();
      if (!value) continue;
      const dedupeKey = value.toLowerCase();
      if (seen[i].has(dedupeKey)) continue;
      seen[i].add(dedupeKey);
      avoid[i].push(value);
    }
  }

  if (avoid.every((list) => list.length === 0)) return null;
  return avoid;
}

/**
 * Strip all {{...}} sections from a prompt, replacing them with their example text.
 */
export function stripVariationSections(prompt: string): string {
  VARIATION_PATTERN.lastIndex = 0;
  return prompt.replace(VARIATION_PATTERN, (_match, content: string) => getExampleText(content));
}

function parseVariationResponse(response: string, count: number): string[] {
  // Try JSON parse directly
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // Try stripping markdown code fences
    const fenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        const parsed = JSON.parse(fenceMatch[1].trim());
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        // Fall through
      }
    }

    // Fall back to splitting by newlines
    const lines = response
      .split("\n")
      .map((line) =>
        line
          .replace(/^\d+[\.\)]\s*/, "")
          .replace(/^[-*]\s*/, "")
          .trim()
      )
      .filter((line) => line.length > 0 && !line.startsWith("[") && !line.startsWith("]"));

    if (lines.length > 0) return lines;
  }

  return [];
}

/**
 * Generate N variations for each section by calling the text model.
 * Returns replacements[sectionIndex][variationIndex].
 */
export async function generateVariations(
  prompt: string,
  sections: VariationSection[],
  count: number,
  images?: Blob[],
  avoidPerSection?: string[][]
): Promise<string[][]> {
  // Prefer assistant-response prefill on providers that support it (Google): telling the
  // model to "avoid X" tends to degrade creative quality, while making it think it's already
  // generated X and asking it to continue the list preserves quality. Replicate can't take a
  // prefilled assistant turn, so it falls back to an instructional avoid-line in the prompt.
  const canPrefill = resolveTextModelProvider() === "google";

  const results = await Promise.all(
    sections.map(async (section, sectionIndex) => {
      const avoid = avoidPerSection?.[sectionIndex] ?? [];
      const usePrefill = canPrefill && avoid.length > 0;
      const useAvoidLine = !canPrefill && avoid.length > 0;

      // When using prefill, we ask the model for the *total* list size (existing + new) so
      // the counts it emits include the prefilled items. We slice those off after parsing.
      const requestCount = usePrefill ? count + avoid.length : count;

      const avoidLine = useAvoidLine
        ? `\nPreviously-used variations to AVOID (do not repeat these or produce trivial synonyms): ${JSON.stringify(avoid)}`
        : "";
      const userPrompt = `Section: "${section.content}"\nFull prompt context: "${prompt}"\nNumber of variations needed: ${requestCount}${avoidLine}`;

      // Build a partial JSON array like `["golden hour", "twilight", ` (open bracket, items,
      // trailing comma, no close bracket) so the model naturally continues the list.
      const prefill = usePrefill ? JSON.stringify(avoid).slice(0, -1) + ", " : undefined;

      try {
        const response = await callTextModel(VARIATION_SYSTEM, userPrompt, images, prefill);
        const parsed = parseVariationResponse(response, requestCount);

        // Drop the prefilled items. If the model ignored the prefill and regenerated fresh
        // content (rare but possible), the slice can discard real results — parseVariationResponse
        // will be padded below, so we still return `count` items in the worst case.
        const variations = usePrefill ? parsed.slice(avoid.length) : parsed;

        // Pad or truncate to exactly `count`
        const example = getExampleText(section.content);
        while (variations.length < count) {
          variations.push(example);
        }

        return variations.slice(0, count);
      } catch {
        // On failure, fall back to the example text for all variations
        const example = getExampleText(section.content);
        return Array(count).fill(example);
      }
    })
  );

  return results;
}
