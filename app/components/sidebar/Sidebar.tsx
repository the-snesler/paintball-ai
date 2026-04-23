import { Expand, Layers, MessageSquareText, X } from "lucide-react";
import { useLocation } from "react-router";
import { PromptInput } from "./PromptInput";
import { ModelList } from "./ModelList";
import { AspectRatioSection } from "./AspectRatioSection";
import { ResolutionSection } from "./ResolutionSection";
import { GenerateButton } from "./GenerateButton";
import { PromptVariationsToggle } from "./PromptVariationsToggle";
import { AvoidPastVariationsToggle } from "./AvoidPastVariationsToggle";
import SVG from "react-inlinesvg";
import drop from "~/drop.svg";
import AddCustomModelButton from "../settings/AddCustomModelButton";
import AddCustomTextModelButton from "../settings/AddCustomTextModelButton";
import AddCustomUpscalerButton from "../settings/AddCustomUpscalerButton";
import SortableModelItem from "../settings/SortableModelItem";
import SortableUpscalerItem from "../settings/SortableUpscalerItem";
import TextModelItem from "../settings/TextModelItem";
import { hasProviderAccess } from "~/lib/providers";
import { useSettingsStore } from "~/stores/settingsStore";
import { useCallback } from "react";
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
      <div className="flex-1 space-y-6 overflow-x-hidden overflow-y-auto p-4 [scrollbar-gutter:stable]">
        <PromptInput />
        <PromptVariationsToggle />
        <AvoidPastVariationsToggle />
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
    <div className="flex-1 space-y-6 overflow-y-auto p-4 [scrollbar-gutter:stable]">
      <RecentSessions />
      <ModelList />
      <AspectRatioSection />
      <ResolutionSection />
    </div>
  );
}

function SettingsSidebarContent() {
  const models = useSettingsStore((s) => s.models);
  const textModels = useSettingsStore((s) => s.textModels);
  const upscalers = useSettingsStore((s) => s.upscalers);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const reorderModels = useSettingsStore((s) => s.reorderModels);
  const reorderUpscalers = useSettingsStore((s) => s.reorderUpscalers);

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

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-4 [scrollbar-gutter:stable]">
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">
          <Layers className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Models</h2>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={models.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
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

      <AddCustomModelButton disabled={!apiKeys.replicate} apiKey={apiKeys.replicate} />

      <div className="flex items-center gap-2 pt-4">
        <span className="text-zinc-500">
          <MessageSquareText className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Text Model</h2>
      </div>

      <div className="space-y-2">
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
        <span className="text-zinc-500">
          <Expand className="h-4 w-4" />
        </span>
        <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Upscalers</h2>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleUpscalerDragEnd}
      >
        <SortableContext
          items={upscalers.map((u) => u.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {upscalers.map((u) => (
              <SortableUpscalerItem
                key={u.id}
                upscaler={u}
                hasApiKey={!!apiKeys.replicate}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <AddCustomUpscalerButton disabled={!apiKeys.replicate} apiKey={apiKeys.replicate} />
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
