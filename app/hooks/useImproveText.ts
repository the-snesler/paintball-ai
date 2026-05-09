import { useCallback, useState } from "react";
import { callTextModel } from "~/lib/textModel";

export function useImproveText({
  systemPrompt,
  text,
  setText,
  getImages,
  baseText: controlledBaseText,
  setBaseText: controlledSetBaseText,
}: {
  systemPrompt: string;
  text: string;
  setText: (next: string) => void;
  getImages?: () => Blob[] | undefined;
  /**
   * When provided alongside `setBaseText`, the snapshot used for undo is
   * controlled externally (e.g. persisted in a Zustand store). Otherwise the
   * hook keeps it in local state.
   */
  baseText?: string | null;
  setBaseText?: (next: string | null) => void;
}) {
  const [localBaseText, setLocalBaseText] = useState<string | null>(null);
  const isControlled = controlledBaseText !== undefined && controlledSetBaseText !== undefined;
  const baseText = isControlled ? controlledBaseText : localBaseText;
  const setBaseText = isControlled ? controlledSetBaseText : setLocalBaseText;

  const [isImproving, setIsImproving] = useState(false);

  const improve = useCallback(async () => {
    if (!text.trim() || isImproving) return;
    const snapshot = text;
    setIsImproving(true);
    try {
      const images = getImages?.();
      const improved = await callTextModel(systemPrompt, text, images);
      setText(improved.trim());
      setBaseText(snapshot);
    } catch {
      // Leave text unchanged on failure
    } finally {
      setIsImproving(false);
    }
  }, [text, isImproving, getImages, setText, systemPrompt, setBaseText]);

  const undo = useCallback(() => {
    if (baseText === null) return;
    setText(baseText);
    setBaseText(null);
  }, [baseText, setText, setBaseText]);

  return {
    isImproving,
    hasUndo: baseText !== null,
    improve,
    undo,
  };
}
