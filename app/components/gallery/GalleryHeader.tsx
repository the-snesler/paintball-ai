import {
  LayoutDashboard,
  GalleryVertical,
  Settings,
  FilePenLine,
  ArrowLeft,
  BarChart3,
} from "lucide-react";
import NumberFlow from "@number-flow/react";
import { useLocation, useNavigate } from "react-router";
import { SearchBar } from "./SearchBar";
import { Tooltip } from "../ui/Tooltip";

interface GalleryHeaderProps {
  count?: number;
  title?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showFavoritesOnly?: boolean;
  onToggleFavorites?: () => void;
  showBackButton?: boolean;
}

export function GalleryHeader({
  count = 0,
  title,
  searchQuery,
  onSearchChange,
  showFavoritesOnly = false,
  onToggleFavorites,
  showBackButton = false,
}: GalleryHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleBack = () => navigate(-1);
  const openGallery = () => navigate("/app");
  const openTimeline = () => navigate("/app/timeline");
  const openStats = () => navigate("/app/stats");
  const openSettings = () => navigate("/app/settings");
  const openEditor = () => navigate("/app/editor");

  return (
    <header className="border-border-subtle flex h-18 items-center gap-2 border-b px-6 py-4">
      <h2 className="text-text-tertiary flex items-center gap-2 truncate text-sm font-medium tracking-wide uppercase">
        {showBackButton && (
          <button
            onClick={handleBack}
            aria-label="Back"
            className="text-text-muted hover:text-text-secondary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
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
            <SearchBar
              value={searchQuery ?? ""}
              onChange={onSearchChange}
              showFavoritesOnly={showFavoritesOnly}
              onToggleFavorites={onToggleFavorites}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-1">
        <div className="bg-surface-raised flex items-center gap-1 rounded-lg p-1">
          <ViewModeButton
            onClick={openGallery}
            isActive={location.pathname === "/app"}
            icon={<LayoutDashboard className="h-4 w-4" />}
            label="Gallery"
          />
          <ViewModeButton
            onClick={openTimeline}
            isActive={location.pathname === "/app/timeline"}
            icon={<GalleryVertical className="h-4 w-4" />}
            label="Timeline"
          />
        </div>
        <ViewModeButton
          onClick={openEditor}
          isActive={location.pathname === "/app/editor"}
          icon={<FilePenLine className="h-4 w-4" />}
          label="Editor"
        />
        <ViewModeButton
          onClick={openStats}
          isActive={location.pathname === "/app/stats"}
          icon={<BarChart3 className="h-4 w-4" />}
          label="Stats"
        />
        <ViewModeButton
          onClick={openSettings}
          isActive={location.pathname === "/app/settings"}
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
        />
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
    <Tooltip content={label} placement="bottom" delay={200}>
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive
          ? "bg-surface-overlay text-text-primary"
          : "text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary"
          }`}
        aria-label={label}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
