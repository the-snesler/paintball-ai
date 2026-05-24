import {
  Archive,
  Expand,
  Image,
  KeyRound,
  Layers,
  MessageSquareText,
  Palette,
  Users,
  X,
} from "lucide-react";
import { useLocation } from "react-router";
import { PromptInput } from "./PromptInput";
import { ModelList } from "./ModelList";
import { UpscalerList } from "./UpscalerList";
import { AspectRatioSection } from "./AspectRatioSection";
import { ResolutionSection } from "./ResolutionSection";
import { QualitySection } from "./QualitySection";
import { NumberOfImagesSection } from "./NumberOfImagesSection";
import { GenerateButton } from "./GenerateButton";
import { PromptVariationsToggle } from "./PromptVariationsToggle";
import { AvoidPastVariationsToggle } from "./AvoidPastVariationsToggle";
import SVG from "react-inlinesvg";
import drop from "~/drop.svg";
import { useEditorStore } from "~/stores/editorStore";
import { useCallback, useEffect, useState } from "react";
import { Accordion } from "@base-ui/react/accordion";
import { RecentSessions } from "./RecentSessions";

export const SIDEBAR_POPOVER_ID = "sidebar-popover";

const SETTINGS_TOC = [
  { id: "api-keys", label: "API Keys", Icon: KeyRound },
  { id: "image-models", label: "Image models", Icon: Layers },
  { id: "characters", label: "Characters", Icon: Users },
  { id: "styles", label: "Styles", Icon: Palette },
  { id: "text-models", label: "Text models", Icon: MessageSquareText },
  { id: "gallery", label: "Gallery", Icon: Image },
  { id: "editor", label: "Editor", Icon: Expand },
  { id: "data", label: "Data", Icon: Archive },
] as const;

function SidebarContent() {
  const location = useLocation();

  if (location.pathname.startsWith("/app/settings")) {
    return <SettingsSidebarContent />;
  } else if (location.pathname.startsWith("/app/editor")) {
    return <EditorSidebarContent />;
  } else {
    return <GallerySidebarContent />;
  }
}

function GallerySidebarContent() {
  return (
    <>
      <div className="flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-3 py-4 [scrollbar-gutter:stable_both-edges]">
        <PromptInput />
        <PromptVariationsToggle />
        <AvoidPastVariationsToggle />
        <Accordion.Root defaultValue={["models"]}>
          <ModelList />
        </Accordion.Root>
        <AspectRatioSection />
        <ResolutionSection />
        <QualitySection />
        <NumberOfImagesSection />
      </div>
      <div className="border-border-subtle border-t p-4">
        <GenerateButton />
      </div>
    </>
  );
}

function EditorSidebarContent() {
  // Models and Upscale Models share an accordion group: only one open at a time.
  const [openPanels, setOpenPanels] = useState<string[]>(["models"]);
  const [highlightUpscalers, setHighlightUpscalers] = useState(false);
  const pendingFocusedPanel = useEditorStore((s) => s.pendingFocusedPanel);
  const setPendingFocusedPanel = useEditorStore((s) => s.setPendingFocusedPanel);

  useEffect(() => {
    if (pendingFocusedPanel !== "upscalers") return;
    setOpenPanels(["upscalers"]);
    setHighlightUpscalers(true);
    setPendingFocusedPanel(null);
    const timer = setTimeout(() => setHighlightUpscalers(false), 1500);
    return () => clearTimeout(timer);
  }, [pendingFocusedPanel, setPendingFocusedPanel]);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4 [scrollbar-gutter:stable_both-edges]">
      <RecentSessions />
      <Accordion.Root
        multiple={false}
        value={openPanels}
        onValueChange={(value) => setOpenPanels(value as string[])}
        className="space-y-6"
      >
        <ModelList />
        <UpscalerList highlight={highlightUpscalers} />
      </Accordion.Root>
      <AspectRatioSection />
      <ResolutionSection />
      <QualitySection />
      <NumberOfImagesSection />
    </div>
  );
}

function SettingsSidebarContent() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
      {SETTINGS_TOC.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => scrollTo(id)}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-surface-overlay transition-colors text-left"
        >
          <Icon className="h-4 w-4 text-text-muted shrink-0" />
          {label}
        </button>
      ))}
    </nav>
  );
}

function SidebarHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="border-border-subtle from-accent to-surface-raised flex h-18 items-center justify-between border-b bg-linear-to-br px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="border-accent bg-accent-muted/50 flex h-8 w-8 items-center justify-center rounded-lg border">
          <SVG src={drop} className="h-4 w-4 text-white" />
        </div>
        <div className="text-left">
          <h1 className="text-sm font-semibold">Paintball</h1>
          <p className="text-text-tertiary text-xs">AI Image Generator</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onClose && (
          <button
            onClick={onClose}
            className="hover:bg-surface-overlay rounded-lg p-2 transition-colors md:hidden"
            aria-label="Close sidebar"
          >
            <X className="text-text-tertiary h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="border-border-subtle bg-surface-raised hidden h-full w-80 shrink-0 flex-col border-r md:flex">
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
      className="sidebar-popover border-border-subtle bg-surface-raised m-0 flex h-full max-h-full w-80 max-w-[85vw] flex-col border-0 border-r p-0"
    >
      <SidebarHeader onClose={handleClose} />
      <SidebarContent />
    </aside>
  );
}
