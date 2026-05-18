import type { GalleryItem } from "~/types";
import type { ReferenceImage, StoredCharacter, StoredStyle } from "~/types";
import { getReferenceImagesByIds } from "~/lib/db";
import { ELABORATE_PROMPT_SYSTEM } from "~/lib/prompts";
import { computeReferencePrecedence } from "~/lib/referencePrecedence";
import { buildElaborationContext, unifyPrompt } from "~/lib/promptUnification";
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
  unifiedPromptAdditions: boolean;
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
      unifiedPromptAdditions: false,
      referenceImages: manualReferenceImages ?? [],
    };
  }

  const manualRefs = manualReferenceImages ?? [];
  const selectedCharacters = characters ?? [];
  const refPlan = await prepareReferenceImages({
    manualRefs,
    style,
    characters: selectedCharacters,
    referenceLimit,
  });

  const textModelImages = refPlan.referenceImages.map((ref) => ref.blob);
  const effectiveImages = textModelImages.length > 0 ? textModelImages : images;
  const styleImagePosition = refPlan.styleImagePosition;

  let workingPrompt = prompt;
  let improved = false;

  if (improvePrompt && isTextModelAvailable() && !(workingPrompt.length > 700)) {
    onStageChange?.("writing");
    try {
      const elaborationContext = buildElaborationContext({
        prompt: workingPrompt,
        characters: selectedCharacters,
        style,
        styleImagePosition,
      });
      const result = await callTextModel(
        ELABORATE_PROMPT_SYSTEM,
        elaborationContext,
        effectiveImages
      );
      const trimmed = result.trim();
      if (trimmed) {
        improved = trimmed !== workingPrompt;
        workingPrompt = trimmed;
      }
    } catch {
      // Fall back to the original prompt
    }
  }

  const hasBlocks = selectedCharacters.length > 0 || Boolean(style?.text.trim());
  let unified = false;
  if (hasBlocks) {
    const beforeUnify = workingPrompt;
    workingPrompt = await unifyPrompt({
      prompt: workingPrompt,
      characters: selectedCharacters,
      style,
      styleImagePosition,
    });
    unified = workingPrompt !== beforeUnify;
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
    unifiedPromptAdditions: unified,
    referenceImages: refPlan.referenceImages,
    variationReplacementsByTask,
  };
}

interface PrepareReferenceImagesResult {
  referenceImages: PreparedReferenceImage[];
  /** 1-indexed position of the style reference image in the final list, if any. */
  styleImagePosition?: number;
}

async function prepareReferenceImages({
  manualRefs,
  style,
  characters,
  referenceLimit,
}: {
  manualRefs: ReferenceImage[];
  style?: StoredStyle | null;
  characters: StoredCharacter[];
  referenceLimit?: number | null;
}): Promise<PrepareReferenceImagesResult> {
  if (!style && characters.length === 0) {
    const precedence = computeReferencePrecedence({
      manualCount: manualRefs.length,
      styleHasRef: false,
      characterRefCount: 0,
      limit: referenceLimit ?? null,
    });

    return {
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

  const precedence = computeReferencePrecedence({
    manualCount: manualRefs.length,
    styleHasRef: styleRef !== null,
    characterRefCount: characterRefs.length,
    limit: referenceLimit ?? null,
  });

  const finalManual = manualRefs.slice(0, precedence.keepManual).map(
    ({ id, blob, sourceGalleryItemId }): PreparedReferenceImage => ({
      id,
      blob,
      sourceGalleryItemId,
    })
  );
  const finalCharacter = characterRefs.slice(0, precedence.keepCharacter);
  const finalStyle = precedence.keepStyle && styleRef ? [styleRef] : [];

  const referenceImages = [...finalManual, ...finalCharacter, ...finalStyle];
  const styleImagePosition = finalStyle.length > 0 ? referenceImages.length : undefined;

  return { referenceImages, styleImagePosition };
}
