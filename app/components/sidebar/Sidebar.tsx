import { Expand, Layers, MessageSquareText, Palette, Plus, Users, X } from "lucide-react";
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
import AddCustomModelButton from "../settings/AddCustomModelButton";
import AddCustomStyleButton from "../settings/AddCustomStyleButton";
import AddCustomTextModelButton from "../settings/AddCustomTextModelButton";
import AddCustomUpscalerButton from "../settings/AddCustomUpscalerButton";
import SortableModelItem from "../settings/SortableModelItem";
import SortableStyleItem from "../settings/SortableStyleItem";
import SortableCharacterItem from "../settings/SortableCharacterItem";
import SortableUpscalerItem from "../settings/SortableUpscalerItem";
import TextModelItem from "../settings/TextModelItem";
import { Link } from "react-router";
import { hasProviderAccess } from "~/lib/providers";
import { useSettingsStore } from "~/stores/settingsStore";
import { useEditorStore } from "~/stores/editorStore";
import { useCallback, useEffect, useState } from "react";
import { Accordion } from "@base-ui/react/accordion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { RecentSessions } from "./RecentSessions";

export const SIDEBAR_POPOVER_ID = "sidebar-popover";

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
  const models = useSettingsStore((s) => s.models);
  const textModels = useSettingsStore((s) => s.textModels);
  const upscalers = useSettingsStore((s) => s.upscalers);
  const styles = useSettingsStore((s) => s.styles);
  const characters = useSettingsStore((s) => s.characters);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const reorderModels = useSettingsStore((s) => s.reorderModels);
  const reorderUpscalers = useSettingsStore((s) => s.reorderUpscalers);
  const reorderStyles = useSettingsStore((s) => s.reorderStyles);
  const reorderCharacters = useSettingsStore((s) => s.reorderCharacters);
  const location = useLocation();

  useEffect(() => {
    if (location.hash === "#characters") {
      const el = document.getElementById("characters");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.hash]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        reorderModels(active.id as string, over.id as string);
      }
    },
    [reorderModels]
  );

  const handleUpscalerDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        reorderUpscalers(active.id as string, over.id as string);
      }
    },
    [reorderUpscalers]
  );

  const handleStyleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        reorderStyles(active.id as string, over.id as string);
      }
    },
    [reorderStyles]
  );

  const handleCharacterDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        reorderCharacters(active.id as string, over.id as string);
      }
    },
    [reorderCharacters]
  );

  return (
    <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4 [scrollbar-gutter:stable_both-edges]">
      <div className="flex items-center gap-2">
        <span className="text-text-muted">
          <Layers className="h-4 w-4" />
        </span>
        <h2 className="text-text-tertiary text-xs font-medium tracking-wide uppercase">
          Image Models
        </h2>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={models.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {models.map((model) => (
              <SortableModelItem
                key={model.id}
                model={model}
                hasApiKey={hasProviderAccess(apiKeys, model.provider)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <AddCustomModelButton />

      <div className="flex items-center gap-2 pt-4">
        <span className="text-text-muted">
          <MessageSquareText className="h-4 w-4" />
        </span>
        <h2 className="text-text-tertiary text-xs font-medium tracking-wide uppercase">
          Text Model
        </h2>
      </div>

      <div className="space-y-1">
        {textModels.map((model) => (
          <TextModelItem
            key={model.id}
            model={model}
            hasApiKey={hasProviderAccess(apiKeys, model.provider)}
          />
        ))}
      </div>

      <AddCustomTextModelButton />

      <div className="flex items-center gap-2 pt-4">
        <span className="text-text-muted">
          <Expand className="h-4 w-4" />
        </span>
        <h2 className="text-text-tertiary text-xs font-medium tracking-wide uppercase">
          Upscalers
        </h2>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleUpscalerDragEnd}
      >
        <SortableContext items={upscalers.map((u) => u.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {upscalers.map((u) => (
              <SortableUpscalerItem key={u.id} upscaler={u} hasApiKey={!!apiKeys.replicate} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <AddCustomUpscalerButton />

      <div className="flex items-center gap-2 pt-4">
        <span className="text-text-muted">
          <Palette className="h-4 w-4" />
        </span>
        <h2 className="text-text-tertiary text-xs font-medium tracking-wide uppercase">Styles</h2>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleStyleDragEnd}
      >
        <SortableContext items={styles.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {styles.map((style) => (
              <SortableStyleItem key={style.id} style={style} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <AddCustomStyleButton />

      <div id="characters" className="flex items-center gap-2 pt-4">
        <span className="text-text-muted">
          <Users className="h-4 w-4" />
        </span>
        <h2 className="text-text-tertiary text-xs font-medium tracking-wide uppercase">
          Characters
        </h2>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleCharacterDragEnd}
      >
        <SortableContext items={characters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {characters.map((character) => (
              <SortableCharacterItem key={character.id} character={character} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Link
        to="/app/characters/new"
        className="border-c-border text-text-tertiary hover:border-c-border hover:text-text-secondary flex w-full items-center gap-2 rounded-lg border border-dashed p-2.5 transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Add character</span>
      </Link>
    </div>
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
