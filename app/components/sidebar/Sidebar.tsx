import { Droplet, Settings } from "lucide-react";
import { PromptInput } from "./PromptInput";
import { ModelList } from "./ModelList";
import { AspectRatioSection } from "./AspectRatioSection";
import { ResolutionSection } from "./ResolutionSection";
import { ReferenceImages } from "./ReferenceImages";
import { GenerateButton } from "./GenerateButton";
import { useSettingsStore } from "~/stores/settingsStore";
import SVG from "react-inlinesvg";
import drop from "~/drop.svg";

export function Sidebar() {
  const openSettingsModal = useSettingsStore((s) => s.openSettingsModal);

  return (
    <aside className="w-80 shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-800 h-18">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
            <SVG src={drop} className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Paintball</h1>
            <p className="text-xs text-zinc-500">AI Image Generation</p>
          </div>
        </div>
        <button
          onClick={openSettingsModal}
          className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <PromptInput />
        <ReferenceImages />
        <ModelList />
        <AspectRatioSection />
        <ResolutionSection />
      </div>

      {/* Generate Button */}
      <div className="p-4 border-t border-zinc-800">
        <GenerateButton />
      </div>
    </aside>
  );
}
