import { callTextModel } from "./textModel";
import { VARIATION_SYSTEM } from "./prompts";

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
  images?: Blob[]
): Promise<string[][]> {
  const results = await Promise.all(
    sections.map(async (section) => {
      const userPrompt = `Section: "${section.content}"\nFull prompt context: "${prompt}"\nNumber of variations needed: ${count}`;

      try {
        const response = await callTextModel(VARIATION_SYSTEM, userPrompt, images);
        const variations = parseVariationResponse(response, count);

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
