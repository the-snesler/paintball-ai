import { ChevronDown, Settings, X } from "lucide-react";
import { PromptInput } from "./PromptInput";
import { ModelList } from "./ModelList";
import { AspectRatioSection } from "./AspectRatioSection";
import { ResolutionSection } from "./ResolutionSection";
import { GenerateButton } from "./GenerateButton";
import { SETTINGS_POPOVER_ID } from "../settings/SettingsModal";
import SVG from "react-inlinesvg";
import drop from "~/drop.svg";
import { OtherSites } from "./OtherSites";

export const SIDEBAR_POPOVER_ID = "sidebar-popover";

function SidebarContent({ onClose }: { onClose?: () => void }) {
  return (
    <>
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between border-b border-zinc-800 bg-linear-to-br from-purple-950 to-zinc-900 h-18"
      >
        <button 
          popoverTarget="other-sites-popover"
          className="flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-purple-900 border border-purple-700 flex items-center justify-center">
            <SVG src={drop} className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-left">
            <h1 className="font-semibold text-sm">Paintball</h1>
            <p className="text-xs text-zinc-500">AI Image Generator</p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <button
            popoverTarget="other-sites-popover"
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Other sites"
          >
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            popoverTarget={SETTINGS_POPOVER_ID}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 text-zinc-400" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors md:hidden"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          )}
        </div>
      </div>
      <OtherSites />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <PromptInput />
        <ModelList />
        <AspectRatioSection />
        <ResolutionSection />
      </div>

      {/* Generate Button */}
      <div className="p-4 border-t border-zinc-800">
        <GenerateButton />
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-80 shrink-0 border-r border-zinc-800 bg-zinc-900 flex-col h-full">
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
      className="sidebar-popover m-0 p-0 w-80 max-w-[85vw] h-full max-h-full border-0 border-r border-zinc-800 bg-zinc-900 flex flex-col"
    >
      <SidebarContent onClose={handleClose} />
    </aside>
  );
}
