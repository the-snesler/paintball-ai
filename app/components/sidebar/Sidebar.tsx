import { ChevronDown, Layers, Loader2, Sparkles, X } from "lucide-react";
import { useLocation } from "react-router";
import { PromptInput } from "./PromptInput";
import { ModelList } from "./ModelList";
import { AspectRatioSection } from "./AspectRatioSection";
import { ResolutionSection } from "./ResolutionSection";
import { GenerateButton } from "./GenerateButton";
import { PromptVariationsToggle } from "./PromptVariationsToggle";
import SVG from "react-inlinesvg";
import drop from "~/drop.svg";
import AddCustomModelButton from "../settings/AddCustomModelButton";
import ModelToggleItem from "../settings/ModelToggle";
import { useSettingsStore } from "~/stores/settingsStore";
import { useState, useEffect } from "react";
import { fetchModelInfo } from "~/lib/replicateSchema";

export const SIDEBAR_POPOVER_ID = "sidebar-popover";

function SidebarContent() {
  const location = useLocation();

  if (location.pathname.startsWith("/settings")) {
    return <SettingsSidebarContent />;
  } else if (location.pathname.startsWith("/editor")) {
    return <EditorSidebarContent />;
  } else {
    return <GallerySidebarContent />;
  }
}

function GallerySidebarContent() {
  return (
    <>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <PromptInput />
        <PromptVariationsToggle />
        <ModelList />
        <AspectRatioSection />
        <ResolutionSection />
      </div>
      <div className="border-t border-zinc-800 p-4">
        <GenerateButton />
      </div>
    </>
  );
}

function EditorSidebarContent() {
  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-4">
      <ModelList />
      <AspectRatioSection />
      <ResolutionSection />
    </div>
  );
}

function SettingsSidebarContent() {
  const models = useSettingsStore((s) => s.models);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const updateModelCapabilities = useSettingsStore((s) => s.updateModelCapabilities);
  const [fetchingSchemas, setFetchingSchemas] = useState(false);

  // Fetch schemas for Replicate models that haven't been fetched yet
  useEffect(() => {
    const unfetchedModels = models.filter(
      (m) => m.provider === "replicate" && !m.schemaFetched && !m.isCustom
    );

    if (unfetchedModels.length === 0 || !apiKeys.replicate) return;

    setFetchingSchemas(true);

    Promise.all(
      unfetchedModels.map(async (model) => {
        try {
          const replicateId = model.id.replace("replicate/", "");
          const { capabilities } = await fetchModelInfo(replicateId, apiKeys.replicate || "");
          updateModelCapabilities(model.id, capabilities, true);
        } catch (err) {
          // Silently fail - keep default capabilities
          console.warn(`Failed to fetch schema for ${model.id}:`, err);
        }
      })
    ).finally(() => {
      setFetchingSchemas(false);
    });
  }, [apiKeys.replicate, models, updateModelCapabilities]);

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-4">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">
          <Layers className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Models</h2>
        {fetchingSchemas && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
      </div>

      <div className="space-y-2">
        {models.map((model) => (
          <ModelToggleItem key={model.id} model={model} hasApiKey={!!apiKeys[model.provider]} />
        ))}
      </div>

      <AddCustomModelButton disabled={!apiKeys.replicate} apiKey={apiKeys.replicate} />
    </div>
  );
}

function SidebarHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex h-18 items-center justify-between border-b border-zinc-800 bg-linear-to-br from-purple-950 to-zinc-900 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-700 bg-purple-900">
          <SVG src={drop} className="h-4 w-4 text-purple-400" />
        </div>
        <div className="text-left">
          <h1 className="text-sm font-semibold">Paintball</h1>
          <p className="text-xs text-zinc-500">AI Image Generator</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
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
  );
}

export function Sidebar() {
  return (
    <aside className="hidden h-full w-80 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 md:flex">
      <SidebarHeader />
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
      <SidebarHeader onClose={handleClose} />
      <SidebarContent />
    </aside>
  );
}
