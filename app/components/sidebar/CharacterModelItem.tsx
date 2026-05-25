import { Box, Check } from "lucide-react";
import SVG from "react-inlinesvg";
import type { StoredModel } from "~/types";
import { PROVIDERS } from "~/lib/providers";

interface CharacterModelItemProps {
  model: StoredModel;
  isSelected: boolean;
  onSelect: () => void;
}

export function CharacterModelItem({ model, isSelected, onSelect }: CharacterModelItemProps) {
  const provider = PROVIDERS[model.provider];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
        isSelected
          ? "border-purple-600/50 bg-purple-900/20"
          : "border-c-border/50 bg-surface-overlay/50 hover:bg-surface-overlay"
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          isSelected
            ? "text-accent-muted bg-purple-500/20"
            : "bg-surface-interactive text-text-tertiary"
        }`}
      >
        {model.icon ? <SVG src={model.icon} className="h-5 w-5" /> : <Box className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-text-primary truncate text-sm font-medium">{model.name}</p>
        <p className="text-text-muted truncate text-xs">{provider.label}</p>
      </div>

      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          isSelected ? "border-purple-500 bg-purple-500 text-white" : "border-c-border"
        }`}
        aria-hidden="true"
      >
        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
      </div>
    </button>
  );
}
