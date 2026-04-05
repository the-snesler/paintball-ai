import { ChevronDown, X } from "lucide-react";
import { useLocation } from "react-router";
import { PromptInput } from "./PromptInput";
import { ModelList } from "./ModelList";
import { AspectRatioSection } from "./AspectRatioSection";
import { ResolutionSection } from "./ResolutionSection";
import { GenerateButton } from "./GenerateButton";
import SVG from "react-inlinesvg";
import drop from "~/drop.svg";
import { OtherSites } from "./OtherSites";

export const SIDEBAR_POPOVER_ID = "sidebar-popover";

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const isEditorRoute = location.pathname === "/editor";

  return (
    <>
      {/* Header */}
      <div className="flex h-18 items-center justify-between border-b border-zinc-800 bg-linear-to-br from-purple-950 to-zinc-900 px-6 py-4">
        <button popoverTarget="other-sites-popover" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-700 bg-purple-900">
            <SVG src={drop} className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-left">
            <h1 className="text-sm font-semibold">Paintball</h1>
            <p className="text-xs text-zinc-500">AI Image Generator</p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <button
            popoverTarget="other-sites-popover"
            className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-zinc-800"
            aria-label="Other sites"
          >
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-zinc-800 md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4 text-zinc-400" />
            </button>
          )}
        </div>
      </div>
      <OtherSites />

      {/* Scrollable Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {!isEditorRoute && <PromptInput />}
        <ModelList />
        <AspectRatioSection />
        <ResolutionSection />
      </div>

      {/* Generate Button — hidden in editor mode */}
      {!isEditorRoute && (
        <div className="border-t border-zinc-800 p-4">
          <GenerateButton />
        </div>
      )}
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden h-full w-80 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 md:flex">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar() {
  const handleClose = () => {
    const popover = document.getElementById(SIDEBAR_POPOVER_ID);
    popover?.hidePopover();
  };

  return (
    <aside
      id={SIDEBAR_POPOVER_ID}
      popover="auto"
      className="sidebar-popover m-0 flex h-full max-h-full w-80 max-w-[85vw] flex-col border-0 border-r border-zinc-800 bg-zinc-900 p-0"
    >
      <SidebarContent onClose={handleClose} />
    </aside>
  );
}
