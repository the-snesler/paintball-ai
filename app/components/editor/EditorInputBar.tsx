import { ArrowUp, Loader2, ScanSearch, Sparkles } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "~/stores/editorStore";
import { useEditorGeneration } from "~/hooks/useEditorGeneration";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import { callTextModel, isTextModelAvailable } from "~/lib/textModel";
import { REVERSE_PROMPT_SYSTEM } from "~/lib/prompts";
import { saveReferenceImage } from "~/lib/db";

interface EditorInputBarProps {
  /** Called when user pastes/drops an image and no source is set yet */
  onSourceFile?: (file: File) => void;
}

export function EditorInputBar({ onSourceFile }: EditorInputBarProps) {
  const instruction = useEditorStore((s) => s.instruction);
  const setInstruction = useEditorStore((s) => s.setInstruction);
  const sourceBlob = useEditorStore((s) => s.sourceBlob);
  const selectedItemId = useEditorStore((s) => s.selectedItemId);
  const isGenerating = useEditorStore((s) => s.isGenerating);
  const setIsGenerating = useEditorStore((s) => s.setIsGenerating);
  const isAnalyzing = useEditorStore((s) => s.isAnalyzing);
  const setAnalyzing = useEditorStore((s) => s.setAnalyzing);
  const setAnalysisResult = useEditorStore((s) => s.setAnalysisResult);
  const addTurn = useEditorStore((s) => s.addTurn);
  const addItemToTurn = useEditorStore((s) => s.addItemToTurn);
  const selectItem = useEditorStore((s) => s.selectItem);
  const turns = useEditorStore((s) => s.turns);

  const modelSelections = useGalleryStore((s) => s.currentModelSelections);
  const aspectRatio = useGalleryStore((s) => s.currentAspectRatio);
  const resolution = useGalleryStore((s) => s.currentResolution);
  const models = useSettingsStore((s) => s.models);

  const { generateEdit } = useEditorGeneration();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const supportsFieldSizing = useMemo(() => {
    if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
    return CSS.supports("field-sizing", "content");
  }, []);

  useLayoutEffect(() => {
    if (supportsFieldSizing) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [instruction, supportsFieldSizing]);

  // Active model names for chip display
  const activeModelNames = useMemo(() => {
    return Object.entries(modelSelections)
      .filter(([, count]) => count > 0)
      .map(([modelId]) => {
        const model = models.find((m) => m.id === modelId);
        return model?.name ?? modelId;
      });
  }, [modelSelections, models]);

  const modelChipLabel = useMemo(() => {
    if (activeModelNames.length === 0) return "No models";
    if (activeModelNames.length === 1) return activeModelNames[0];
    return `${activeModelNames[0]} +${activeModelNames.length - 1}`;
  }, [activeModelNames]);

  const hasSource = sourceBlob !== null;
  const canSubmit = hasSource && instruction.trim().length > 0 && !isGenerating && !isAnalyzing;

  // Resolve current canvas blob
  const getCanvasBlob = useCallback((): Blob | null => {
    if (selectedItemId) {
      const item = useGalleryStore.getState().items.find((i) => i.id === selectedItemId);
      if (item && item.status === "completed") return item.originalBlob;
    }
    return sourceBlob;
  }, [selectedItemId, sourceBlob]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    const canvasBlob = getCanvasBlob();
    if (!canvasBlob) return;

    setIsGenerating(true);
    const text = instruction.trim();
    setInstruction("");

    try {
      // Save the canvas blob as a reference image for retry support
      const refId = crypto.randomUUID();
      await saveReferenceImage({ id: refId, blob: canvasBlob, name: "editor-source" });

      const turnId = crypto.randomUUID();
      addTurn({
        id: turnId,
        instruction: text,
        sourceItemId: selectedItemId,
        sourceBlob: canvasBlob,
        createdAt: Date.now(),
      });

      await generateEdit({
        instruction: text,
        referenceBlob: canvasBlob,
        referenceId: refId,
        modelSelections,
        aspectRatio,
        resolution,
        onItemsCreated: (itemIds) => {
          for (const id of itemIds) {
            addItemToTurn(turnId, id);
          }
          // Deselect source while generating
          selectItem(null);
        },
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    canSubmit,
    getCanvasBlob,
    instruction,
    setInstruction,
    setIsGenerating,
    selectedItemId,
    addTurn,
    addItemToTurn,
    selectItem,
    generateEdit,
    modelSelections,
    aspectRatio,
    resolution,
  ]);

  const handleAnalyze = useCallback(async () => {
    const canvasBlob = getCanvasBlob();
    if (!canvasBlob || isAnalyzing) return;

    setAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await callTextModel(
        REVERSE_PROMPT_SYSTEM,
        "Write a generation prompt for this image.",
        [canvasBlob]
      );
      setAnalysisResult(result.trim());
    } catch {
      // silently fail
    } finally {
      setAnalyzing(false);
    }
  }, [getCanvasBlob, isAnalyzing, setAnalyzing, setAnalysisResult]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file && file.type.startsWith("image/")) {
            e.preventDefault();
            if (!hasSource && onSourceFile) {
              onSourceFile(file);
            }
            return;
          }
        }
      }
    },
    [hasSource, onSourceFile]
  );

  const turnCount = turns.length;

  return (
    <div className="shrink-0">
      <div className="px-6 py-4">
        <div className="mx-auto max-w-3xl">
          {/* Textarea */}
          <div
            className={`rounded-xl border bg-zinc-800/80 transition-all duration-200 ${
              !hasSource
                ? "border-zinc-700/50 opacity-60"
                : "border-zinc-700 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600/50"
            }`}
          >
            <textarea
              ref={textareaRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                !hasSource
                  ? "Paste or drop an image to begin editing…"
                  : selectedItemId || turnCount === 0
                    ? "Describe your edit… (Ctrl+Enter to send)"
                    : "Select an image above, then describe your edit…"
              }
              disabled={!hasSource || isGenerating}
              rows={1}
              className="field-sizing-content max-h-48 min-h-11 w-full resize-none rounded-t-xl bg-transparent px-4 pt-3 pb-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none disabled:cursor-not-allowed"
            />

            {/* Bottom row of input */}
            <div className="flex items-center justify-between gap-2 px-3 pb-3">
              {/* Left: model chip + analyze */}
              <div className="flex min-w-0 items-center gap-2">
                {/* Model chip */}
                <div className="flex max-w-40 items-center gap-1.5 truncate rounded-full bg-zinc-700/60 px-2.5 py-1 text-xs text-zinc-400">
                  <Sparkles className="h-3 w-3 shrink-0 text-purple-400" />
                  <span className="truncate">{modelChipLabel}</span>
                </div>

                {/* Analyze button */}
                <button
                  type="button"
                  onClick={() => void handleAnalyze()}
                  disabled={!hasSource || isAnalyzing || isGenerating}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-700/60 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Analyze image and generate a prompt"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ScanSearch className="h-3 w-3" />
                  )}
                  {isAnalyzing ? "Analyzing…" : "Analyze"}
                </button>
              </div>

              {/* Right: send button */}
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150 ${
                  canSubmit
                    ? "-translate-y-0.5 bg-purple-600 text-white shadow-lg shadow-purple-900/40 hover:bg-purple-500 active:translate-y-0"
                    : "cursor-not-allowed bg-zinc-700/50 text-zinc-600"
                }`}
                title="Send edit (Ctrl+Enter)"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
