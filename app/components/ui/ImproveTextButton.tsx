import { Loader2, Sparkles, Undo2 } from "lucide-react";

export function ImproveTextButton({
  isImproving,
  hasUndo,
  onImprove,
  onUndo,
  canImprove,
}: {
  isImproving: boolean;
  hasUndo: boolean;
  onImprove: () => void;
  onUndo: () => void;
  canImprove: boolean;
}) {
  if (hasUndo) {
    return (
      <button
        type="button"
        onClick={onUndo}
        className="text-text-tertiary hover:text-text-secondary inline-flex items-center gap-1 text-xs transition-colors"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onImprove}
      disabled={!canImprove || isImproving}
      className="text-text-tertiary hover:text-text-secondary disabled:text-text-muted inline-flex items-center gap-1 text-xs transition-colors disabled:cursor-not-allowed"
    >
      {isImproving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {isImproving ? "Working..." : "Rewrite"}
    </button>
  );
}
