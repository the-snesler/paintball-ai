import { LayoutDashboard, GalleryVertical, Settings, FilePenLine } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { useLocation, useNavigate } from "react-router";
import { SearchBar } from "./SearchBar";

interface GalleryHeaderProps {
  count?: number;
  title?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function GalleryHeader({ count = 0, title, searchQuery, onSearchChange }: GalleryHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const openGallery = () => navigate("/");
  const openTimeline = () => navigate("/timeline");
  const openSettings = () => navigate("/settings");
  const openEditor = () => navigate("/editor");

  return (
    <header className="flex h-18 items-center gap-2 border-b border-zinc-800 px-6 py-4">
      <h2 className="truncate text-sm font-medium tracking-wide text-zinc-400 uppercase">
        {title ? (
          title
        ) : (
          <>
            <NumberFlow
              value={count}
              format={{ useGrouping: false }}
              transformTiming={{ duration: 300, easing: "ease-out" }}
              spinTiming={{ duration: 300, easing: "ease-out" }}
              opacityTiming={{ duration: 150, easing: "ease-out" }}
              willChange
            />{" "}
            Generation{count !== 1 ? "s" : ""}
          </>
        )}
      </h2>

      {onSearchChange ? (
        <div className="flex-1 px-4">
          <div className="mx-auto max-w-sm">
            <SearchBar value={searchQuery ?? ""} onChange={onSearchChange} />
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-900 p-1">
          <ViewModeButton
            onClick={openGallery}
            isActive={location.pathname === "/"}
            icon={<LayoutDashboard className="h-4 w-4" />}
            label=""
          />
          <ViewModeButton
            onClick={openTimeline}
            isActive={location.pathname === "/timeline"}
            icon={<GalleryVertical className="h-4 w-4" />}
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
          <FilePenLine className="h-4 w-4" />
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
          <Settings className="h-4 w-4" />
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
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
