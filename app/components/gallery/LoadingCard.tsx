import { Loader2, AlertCircle, X } from "lucide-react";
import type { PendingGeneration } from "~/types";
import { useGenerationStore } from "~/stores/generationStore";

interface LoadingCardProps {
  generation: PendingGeneration;
}

export function LoadingCard({ generation }: LoadingCardProps) {
  const dismissFailedGeneration = useGenerationStore((s) => s.dismissFailedGeneration);
  const isFailed = generation.status === "failed";

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissFailedGeneration(generation.id);
  };

  return (
    <div className="relative rounded-lg overflow-hidden bg-zinc-900 aspect-square animate-fade-in">
      {/* Background */}
      <div
        className={`absolute inset-0 ${
          isFailed ? "bg-red-950/30" : "bg-zinc-800 animate-pulse-subtle"
        }`}
      />

      {/* Dismiss button for failed generations */}
      {isFailed && (
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors z-10"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      )}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        {isFailed ? (
          <>
            <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-red-400 text-center line-clamp-3">
              {generation.error || "Generation failed"}
            </p>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
            <p className="text-sm text-zinc-400">Generating...</p>
          </>
        )}
      </div>

      {/* Model badge */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white/90">
        {generation.modelName}
      </div>
    </div>
  );
}
