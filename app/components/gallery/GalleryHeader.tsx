import { LayoutDashboard, GalleryVertical, Settings, FilePenLine } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { useLocation, useNavigate } from "react-router";
import { useGalleryStore } from "~/stores/galleryStore";
import type { ViewMode } from "~/types";

interface GalleryHeaderProps {
  count?: number;
  title?: string;
}

export function GalleryHeader({ count = 0, title }: GalleryHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const viewMode = useGalleryStore((s) => s.viewMode);
  const setViewMode = useGalleryStore((s) => s.setViewMode);
  const isRoot = location.pathname === "/";

  const handleViewModeSelect = (mode: ViewMode) => {
    setViewMode(mode);
    navigate("/");
  };

  const openSettings = () => navigate("/settings");
  const openEditor = () => navigate("/editor");

  return (
    <header className="flex items-center gap-2 px-6 py-4 border-b border-zinc-800 h-18">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide truncate">
        {title ? (
          title
        ) : (
          <>
            <NumberFlow
              value={count}
              format={{ useGrouping: false }}
              transformTiming={{ duration: 300, easing: 'ease-out' }}
              spinTiming={{ duration: 300, easing: 'ease-out' }}
              opacityTiming={{ duration: 150, easing: 'ease-out' }}
              willChange
            /> Generation{count !== 1 ? "s" : ""}
          </>
        )}
      </h2>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <div className="flex gap-1 items-center bg-zinc-900 rounded-lg p-1">
          <ViewModeButton
            onClick={() => handleViewModeSelect("grid")}
            isActive={isRoot && viewMode === "grid"}
            icon={<LayoutDashboard className="w-4 h-4" />}
            label=""
          />
          <ViewModeButton
            onClick={() => handleViewModeSelect("timeline")}
            isActive={isRoot && viewMode === "timeline"}
            icon={<GalleryVertical className="w-4 h-4" />}
            label=""
          />
        </div>
        <button
          onClick={openEditor}
          aria-label="Open Editor"
          title="Open Editor"
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            location.pathname === "/editor"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
        >
          <FilePenLine className="w-4 h-4" />
        </button>
        <button
          onClick={openSettings}
          aria-label="Settings"
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            location.pathname === "/settings"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

function ViewModeButton({
  onClick,
  isActive,
  icon,
  label,
}: {
  onClick: () => void;
  isActive: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
