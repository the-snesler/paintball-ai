import { Box, Minus, Plus, Sparkles } from "lucide-react";
import type { StoredModel } from "~/types";
import { useGalleryStore } from "~/stores/galleryStore";

interface ModelItemProps {
  model: StoredModel;
  count: number;
}

const providerIcons: Record<string, React.ReactNode> = {
  google: <Sparkles className="w-4 h-4" />,
  replicate: <Box className="w-4 h-4" />,
};

const providerNames: Record<string, string> = {
  google: "Google",
  replicate: "Replicate",
};

export function ModelItem({ model, count }: ModelItemProps) {
  const setModelCount = useGalleryStore((s) => s.setModelCount);

  const isActive = count > 0;

  const handleDecrement = () => {
    if (count > 0) {
      setModelCount(model.id, count - 1);
    }
  };

  const handleIncrement = () => {
    setModelCount(model.id, count + 1);
  };

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
        isActive
          ? "bg-purple-500/10 border border-purple-500/30"
          : "bg-zinc-800/50 border border-transparent hover:bg-zinc-800"
      }`}
    >
      {/* Icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isActive ? "bg-purple-500/20 text-purple-400" : "bg-zinc-700 text-zinc-400"
        }`}
      >
        {providerIcons[model.provider] || <Sparkles className="w-4 h-4" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100 truncate" title={model.name}>{model.name}</p>
        <p className="text-xs text-zinc-500">{providerNames[model.provider]}</p>
      </div>

      {/* Counter */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleDecrement}
          disabled={count === 0}
          className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Decrease count"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-6 text-center text-sm font-medium text-zinc-300">
          {count}
        </span>
        <button
          onClick={handleIncrement}
          className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
          aria-label="Increase count"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
