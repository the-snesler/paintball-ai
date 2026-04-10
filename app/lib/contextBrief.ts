import type { EditorTurn } from "~/types";
import { callTextModel, isTextModelAvailable } from "./textModel";
import { CONTEXT_BRIEF_SYSTEM } from "./prompts";
import { logger } from "./logging";

const MAX_LINEAGE_INSTRUCTIONS = 10;

/**
 * Walk the DAG backwards from `turn` to the original source, collecting
 * instructions in chronological (oldest-first) order.
 */
export function getLineageInstructions(
  turns: EditorTurn[],
  turn: EditorTurn,
  sourcePrompt: string
): string[] {
  const instructions: string[] = [];
  let current: EditorTurn | undefined = turn;

  while (current) {
    instructions.unshift(current.instruction);

    if (current.sourceItemId === null) {
      break;
    }

    const parentItemId = current.sourceItemId;
    current = turns.find((t) => t.itemIds.includes(parentItemId));
  }

  if (sourcePrompt.trim()) {
    instructions.unshift(`[Original image: ${sourcePrompt}]`);
  }

  return instructions.slice(-MAX_LINEAGE_INSTRUCTIONS);
}

/**
 * Find which turn produced the given gallery item and return its context brief.
 */
export function getSourceTurnBrief(
  turns: EditorTurn[],
  selectedItemId: string | null
): string | null {
  if (!selectedItemId) return null;
  const sourceTurn = turns.find((t) => t.itemIds.includes(selectedItemId));
  return sourceTurn?.contextBrief ?? null;
}

/**
 * Generate a context brief for a turn by summarizing the lineage of editing
 * instructions. Returns empty string on failure or when the lineage is too
 * short to produce a useful brief. Never throws.
 */
export async function generateContextBrief(
  turns: EditorTurn[],
  turn: EditorTurn,
  sourcePrompt: string
): Promise<string> {
  try {
    if (!isTextModelAvailable()) return "";

    const instructions = getLineageInstructions(turns, turn, sourcePrompt);
    if (instructions.length === 0) return "";

    const userPrompt = instructions
      .map((inst, i) => `${i + 1}. ${inst}`)
      .join("\n");

    const brief = await callTextModel(CONTEXT_BRIEF_SYSTEM, userPrompt);
    const trimmed = brief.trim();

    logger.debug("Context brief generated:", trimmed);
    return trimmed;
  } catch (error) {
    logger.debug("Context brief generation failed:", error);
    return "";
  }
}
