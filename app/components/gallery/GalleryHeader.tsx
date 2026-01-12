import { LayoutGrid, Clock } from "lucide-react";
import { useGalleryStore } from "~/stores/galleryStore";
import type { ViewMode } from "~/types";

interface GalleryHeaderProps {
  count: number;
}

export function GalleryHeader({ count }: GalleryHeaderProps) {
  const viewMode = useGalleryStore((s) => s.viewMode);
  const setViewMode = useGalleryStore((s) => s.setViewMode);

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 h-18">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
        {count} Generation{count !== 1 ? "s" : ""}
      </h2>

      <div className="flex items-center bg-zinc-900 rounded-lg p-1">
        <ViewModeButton
          mode="grid"
          currentMode={viewMode}
          onClick={() => setViewMode("grid")}
          icon={<LayoutGrid className="w-4 h-4" />}
          label="Grid"
        />
        <ViewModeButton
          mode="timeline"
          currentMode={viewMode}
          onClick={() => setViewMode("timeline")}
          icon={<Clock className="w-4 h-4" />}
          label="Timeline"
        />
      </div>
    </header>
  );
}

function ViewModeButton({
  mode,
  currentMode,
  onClick,
  icon,
  label,
}: {
  mode: ViewMode;
  currentMode: ViewMode;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  const isActive = mode === currentMode;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:text-zinc-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
