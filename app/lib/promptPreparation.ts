import type { GalleryItem } from "~/types";
import type { ReferenceImage, StoredCharacter, StoredStyle } from "~/types";
import { getReferenceImagesByIds } from "~/lib/db";
import { IMPROVE_PROMPT_SYSTEM } from "~/lib/prompts";
import { computeReferencePrecedence } from "~/lib/referencePrecedence";
import { applyPromptAdditions } from "~/lib/styleApplication";
import { callTextModel, isTextModelAvailable } from "~/lib/textModel";
import {
  buildVariedPrompts,
  collectAvoidList,
  generateVariations,
  parseVariationSections,
  stripVariationSections,
} from "~/lib/promptVariations";

export interface PreparedReferenceImage {
  id: string;
  blob: Blob;
  sourceGalleryItemId?: string;
}

interface PreparePromptBatchOptions {
  prompt: string;
  totalTasks: number;
  images?: Blob[];
  manualReferenceImages?: ReferenceImage[];
  style?: StoredStyle | null;
  characters?: StoredCharacter[];
  referenceLimit?: number | null;
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
  addedPromptAdditions: boolean;
  referenceImages: PreparedReferenceImage[];
  variationReplacementsByTask?: Array<string[] | undefined>;
}

export async function preparePromptBatch(
  options: PreparePromptBatchOptions
): Promise<PreparedPromptBatch> {
  const {
    prompt,
    totalTasks,
    images,
    manualReferenceImages,
    style,
    characters,
    referenceLimit,
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
      addedPromptAdditions: false,
      referenceImages: manualReferenceImages ?? [],
    };
  }

  const manualRefs = manualReferenceImages ?? [];
  const promptAdditions = await preparePromptAdditions({
    prompt,
    manualRefs,
    style,
    characters: characters ?? [],
    referenceLimit,
  });

  let workingPrompt = promptAdditions.prompt;
  const textModelImages = promptAdditions.referenceImages.map((ref) => ref.blob);
  const effectiveImages = textModelImages.length > 0 ? textModelImages : images;
  let improved = false;

  if (
    improvePrompt &&
    isTextModelAvailable() &&
    !(workingPrompt.length > 1000 && !promptAdditions.added)
  ) {
    // Avoid improving if the prompt is already long and we didn't add anything, as it's unlikely to help and may make it worse
    onStageChange?.("writing");
    try {
      const result = await callTextModel(IMPROVE_PROMPT_SYSTEM, workingPrompt, effectiveImages);
      const trimmed = result.trim();
      if (trimmed) {
        workingPrompt = trimmed;
        improved = trimmed !== promptAdditions.prompt;
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
          effectiveImages,
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
    variationsEnabled && !variedPrompts ? stripVariationSections(workingPrompt) : workingPrompt;

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
    addedPromptAdditions: promptAdditions.added,
    referenceImages: promptAdditions.referenceImages,
    variationReplacementsByTask,
  };
}

async function preparePromptAdditions({
  prompt,
  manualRefs,
  style,
  characters,
  referenceLimit,
}: {
  prompt: string;
  manualRefs: ReferenceImage[];
  style?: StoredStyle | null;
  characters: StoredCharacter[];
  referenceLimit?: number | null;
}): Promise<{
  prompt: string;
  added: boolean;
  referenceImages: PreparedReferenceImage[];
}> {
  if (!style && characters.length === 0) {
    const precedence = computeReferencePrecedence({
      manualCount: manualRefs.length,
      styleHasRef: false,
      characterRefCount: 0,
      limit: referenceLimit ?? null,
    });

    return {
      prompt,
      added: false,
      referenceImages: manualRefs
        .slice(0, precedence.keepManual)
        .map(({ id, blob, sourceGalleryItemId }) => ({
          id,
          blob,
          sourceGalleryItemId,
        })),
    };
  }

  let styleRef: PreparedReferenceImage | null = null;
  if (style?.referenceImageId) {
    const [loaded] = await getReferenceImagesByIds([style.referenceImageId]);
    if (loaded) {
      styleRef = { id: loaded.id, blob: loaded.blob };
      URL.revokeObjectURL(loaded.url);
    }
  }

  const characterRefIds = characters.flatMap((c) => c.referenceImageIds);
  let characterRefs: PreparedReferenceImage[] = [];
  if (characterRefIds.length) {
    const loaded = await getReferenceImagesByIds(characterRefIds);
    const byId = new Map(loaded.map((ref) => [ref.id, ref]));
    for (const ref of loaded) URL.revokeObjectURL(ref.url);
    characterRefs = characterRefIds
      .map((id) => byId.get(id))
      .filter((ref): ref is NonNullable<typeof ref> => ref !== undefined)
      .map((ref) => ({ id: ref.id, blob: ref.blob }));
  }

  const effectiveStyle = styleRef
    ? style
    : style
      ? { ...style, referenceImageId: undefined }
      : null;

  const precedence = computeReferencePrecedence({
    manualCount: manualRefs.length,
    styleHasRef: styleRef !== null,
    characterRefCount: characterRefs.length,
    limit: referenceLimit ?? null,
  });
  const additions = applyPromptAdditions(
    prompt,
    characters,
    effectiveStyle ?? null,
    precedence.keepManual + precedence.keepCharacter
  );

  const finalManual = manualRefs.slice(0, precedence.keepManual).map(
    ({ id, blob, sourceGalleryItemId }): PreparedReferenceImage => ({
      id,
      blob,
      sourceGalleryItemId,
    })
  );
  const finalCharacter = characterRefs.slice(0, precedence.keepCharacter);
  const finalStyle = precedence.keepStyle && styleRef ? [styleRef] : [];

  return {
    prompt: additions.prompt,
    added: additions.prompt !== prompt || finalStyle.length > 0 || finalCharacter.length > 0,
    referenceImages: [...finalManual, ...finalCharacter, ...finalStyle],
  };
}
