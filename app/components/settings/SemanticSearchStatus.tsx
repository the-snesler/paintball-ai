import { useEmbeddingStatusStore } from "~/stores/embeddingStatusStore";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function SemanticSearchStatus() {
  const modelLoadState = useEmbeddingStatusStore((s) => s.modelLoadState);
  const progress = useEmbeddingStatusStore((s) => s.modelDownloadProgress);
  const bytes = useEmbeddingStatusStore((s) => s.modelDownloadBytes);
  const modelId = useEmbeddingStatusStore((s) => s.modelId);
  const indexed = useEmbeddingStatusStore((s) => s.indexed);
  const total = useEmbeddingStatusStore((s) => s.total);
  const lastError = useEmbeddingStatusStore((s) => s.lastError);
  const errorCount = useEmbeddingStatusStore((s) => s.errorCount);
  const clearErrors = useEmbeddingStatusStore((s) => s.clearErrors);

  const modelLine = (() => {
    switch (modelLoadState) {
      case "idle":
        return <span className="text-text-muted">Model: not loaded</span>;
      case "downloading": {
        const pct = Math.round(progress * 100);
        const bytesText = bytes
          ? ` ${formatBytes(bytes.loaded)} / ${formatBytes(bytes.total)}`
          : "";
        return (
          <div className="flex flex-col gap-1">
            <span className="text-text-muted">
              Model: downloading…{bytesText} ({pct}%)
            </span>
            <div className="bg-surface-overlay h-1 w-full overflow-hidden rounded-full">
              <div
                className="h-full bg-purple-500 transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      }
      case "ready":
        return (
          <span className="text-text-muted">Model: ready{modelId ? ` (${modelId})` : ""}</span>
        );
      case "error":
        return <span className="text-red-400">Model: failed to load</span>;
    }
  })();

  return (
    <div className="border-border-subtle space-y-1.5 border-t pt-2 font-mono text-[11px] leading-tight">
      {modelLine}
      <div className="text-text-muted">
        Indexed: {indexed} / {total} image{total === 1 ? "" : "s"}
      </div>
      {errorCount > 0 && (
        <div className="flex items-center gap-2 text-red-400">
          <span className="truncate">
            {errorCount} error{errorCount === 1 ? "" : "s"}
            {lastError ? ` — last: "${lastError}"` : ""}
          </span>
          <button
            type="button"
            onClick={clearErrors}
            className="bg-surface-overlay text-text-tertiary hover:bg-surface-interactive hover:text-text-secondary rounded px-1.5 py-0.5 text-[10px] transition-colors"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
