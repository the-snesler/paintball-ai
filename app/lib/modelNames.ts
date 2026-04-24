const ICON_PATTERNS: [RegExp, string][] = [
  [/^openai\/|gpt/i, "/icons/openai.svg"],
  [/^black-forest-labs\/|flux/i, "/icons/bfl.svg"],
  [/^google\/|gemini/i, "/icons/google.svg"],
  [/^bytedance\/|seedream/i, "/icons/bytedance.svg"],
  [/recraft/i, "/icons/recraft.svg"],
];

const DEFAULT_ICON = "/icons/box.svg";

export function inferIcon(modelId: string): string | undefined {
  for (const [pattern, icon] of ICON_PATTERNS) {
    if (pattern.test(modelId)) {
      return icon;
    }
  }
  return DEFAULT_ICON;
}

const NAME_PATTERNS: [RegExp, string][] = [
  [/gpt/i, "GPT"],
  [/svg/i, "SVG"],
  [/v(\d)/i, "v$1"],
];

/**
 * Converts "owner/model-name" to "Model Name", with some special cases for common patterns.
 */
export function inferName(modelId: string): string {
  let rawName = modelId.split("/").pop() || modelId;

  rawName = rawName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  for (const [pattern, replacement] of NAME_PATTERNS) {
    rawName = rawName.replace(pattern, replacement);
  }
  return rawName;
}
