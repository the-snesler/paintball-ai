import { useEffect, useState } from "react";
import { embedQueryText } from "~/lib/embeddingQueue";
import { logger } from "~/lib/logging";
import { useEmbeddingStatusStore } from "~/stores/embeddingStatusStore";

const DEBOUNCE_MS = 200;

export function useQueryEmbedding(query: string, enabled: boolean): number[] | null {
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const modelLoadState = useEmbeddingStatusStore((s) => s.modelLoadState);

  useEffect(() => {
    if (!enabled || !query.trim() || modelLoadState !== "ready") {
      setEmbedding(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      embedQueryText(query.trim(), controller.signal)
        .then((vec) => {
          if (!controller.signal.aborted) setEmbedding(vec);
          logger.debug("Query embedding updated", { query, embedding: vec });
        })
        .catch((err) => {
          if (err instanceof Error && err.name === "AbortError") return;
          // Surface non-abort errors via the status store; query embedding
          // failures shouldn't block substring search.
          useEmbeddingStatusStore.getState().reportEmbedError(
            err instanceof Error ? err.message : String(err)
          );
          logger.error("Failed to embed query", { query, error: err });
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, enabled, modelLoadState]);

  return embedding;
}
