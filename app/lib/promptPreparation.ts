import type { GalleryItem } from "~/types";
import { IMPROVE_PROMPT_SYSTEM } from "~/lib/prompts";
import { callTextModel, isTextModelAvailable } from "~/lib/textModel";
import {
  buildVariedPrompts,
  collectAvoidList,
  generateVariations,
  parseVariationSections,
  stripVariationSections,
} from "~/lib/promptVariations";

interface PreparePromptBatchOptions {
  prompt: string;
  totalTasks: number;
  images?: Blob[];
  improvePrompt?: boolean;
  variationsEnabled?: boolean;
  avoidPastVariations?: boolean;
  galleryItemsForAvoid?: GalleryItem[];
  onStageChange?: (stage: "writing" | "variating") => void;
}

export interface PreparedPromptBatch {
  prompts: string[];
  improved: boolean;
  usedVariations: boolean;
  variationReplacementsByTask?: Array<string[] | undefined>;
}

export async function preparePromptBatch(
  options: PreparePromptBatchOptions
): Promise<PreparedPromptBatch> {
  const {
    prompt,
    totalTasks,
    images,
    improvePrompt = false,
    variationsEnabled = false,
    avoidPastVariations = false,
    galleryItemsForAvoid,
    onStageChange,
  } = options;

  if (totalTasks <= 0) {
    return {
      prompts: [],
      improved: false,
      usedVariations: false,
    };
  }

  let workingPrompt = prompt;
  let improved = false;

  if (improvePrompt && isTextModelAvailable()) {
    onStageChange?.("writing");
    try {
      const result = await callTextModel(IMPROVE_PROMPT_SYSTEM, prompt, images);
      const trimmed = result.trim();
      if (trimmed) {
        workingPrompt = trimmed;
        improved = trimmed !== prompt;
      }
    } catch {
      // Fall back to the original prompt
    }
  }

  let variedPrompts: string[] | null = null;
  let variationReplacements: string[][] | null = null;

  if (variationsEnabled) {
    const sections = parseVariationSections(workingPrompt);
    if (sections.length > 0) {
      onStageChange?.("variating");
      try {
        const avoidPerSection =
          avoidPastVariations && galleryItemsForAvoid
            ? (collectAvoidList(workingPrompt, galleryItemsForAvoid) ?? undefined)
            : undefined;

        const replacements = await generateVariations(
          workingPrompt,
          sections,
          totalTasks,
          images,
          avoidPerSection
        );

        variedPrompts = buildVariedPrompts(workingPrompt, sections, replacements);
        variationReplacements = replacements;
      } catch {
        variedPrompts = null;
        variationReplacements = null;
      }
    }
  }

  const fallbackPrompt =
    variationsEnabled && !variedPrompts
      ? stripVariationSections(workingPrompt)
      : workingPrompt;

  const prompts = Array.from({ length: totalTasks }, (_, taskIndex) => {
    if (!variedPrompts) return fallbackPrompt;
    return variedPrompts[taskIndex] ?? fallbackPrompt;
  });

  const variationReplacementsByTask = variationReplacements
    ? prompts.map((_, taskIndex) => variationReplacements.map((col) => col[taskIndex]))
    : undefined;

  return {
    prompts,
    improved,
    usedVariations: Boolean(variedPrompts),
    variationReplacementsByTask,
  };
}
