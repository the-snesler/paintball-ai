import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  Loader2,
  MessageSquareText,
  Archive,
  Download,
  Upload,
  Layers,
  Users,
  Palette,
  Expand,
  Image,
  Plus,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router";
import { GalleryHeader } from "~/components/gallery/GalleryHeader";
import { useSettingsStore } from "~/stores/settingsStore";
import { useGalleryStore } from "~/stores/galleryStore";
import { getImageCount } from "~/lib/db";
import { exportAllImages, importFromZip } from "~/lib/exportImport";
import { enqueueMissingEmbeddings, refreshEmbeddingCounts } from "~/lib/embeddingQueue";
import { useEmbeddingStatusStore } from "~/stores/embeddingStatusStore";
import type { ApiKeyProvider } from "~/types";
import { Switch } from "~/components/ui/Switch";
import { SemanticSearchStatus } from "./SemanticSearchStatus";
import { hasProviderAccess } from "~/lib/providers";
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
import SortableModelItem from "./SortableModelItem";
import SortableStyleItem from "./SortableStyleItem";
import SortableCharacterItem from "./SortableCharacterItem";
import SortableUpscalerItem from "./SortableUpscalerItem";
import TextModelItem from "./TextModelItem";
import AddCustomModelButton from "./AddCustomModelButton";
import AddCustomStyleButton from "./AddCustomStyleButton";
import AddCustomTextModelButton from "./AddCustomTextModelButton";
import AddCustomUpscalerButton from "./AddCustomUpscalerButton";

const providers: { id: ApiKeyProvider; name: string; description: string; link: string }[] = [
  {
    id: "google",
    name: "Google AI",
    description: "For Gemini image generation models",
    link: "https://aistudio.google.com/",
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "For Flux, GPT Image, and other community models",
    link: "https://replicate.com/",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "For GPT Image generation models",
    link: "https://platform.openai.com/api-keys",
  },
];

export function SettingsModal() {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const models = useSettingsStore((s) => s.models);
  const textModels = useSettingsStore((s) => s.textModels);
  const upscalers = useSettingsStore((s) => s.upscalers);
  const styles = useSettingsStore((s) => s.styles);
  const characters = useSettingsStore((s) => s.characters);
  const desktopNotificationsEnabled = useSettingsStore((s) => s.desktopNotificationsEnabled);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const editorContextInjectionEnabled = useSettingsStore((s) => s.editorContextInjectionEnabled);
  const alwaysImprovePromptEnabled = useSettingsStore((s) => s.alwaysImprovePromptEnabled);
  const semanticSearchEnabled = useSettingsStore((s) => s.semanticSearchEnabled);
  const setDesktopNotificationsEnabled = useSettingsStore((s) => s.setDesktopNotificationsEnabled);
  const setEditorContextInjectionEnabled = useSettingsStore(
    (s) => s.setEditorContextInjectionEnabled
  );
  const setAlwaysImprovePromptEnabled = useSettingsStore((s) => s.setAlwaysImprovePromptEnabled);
  const setSemanticSearchEnabled = useSettingsStore((s) => s.setSemanticSearchEnabled);
  const reorderModels = useSettingsStore((s) => s.reorderModels);
  const reorderUpscalers = useSettingsStore((s) => s.reorderUpscalers);
  const reorderStyles = useSettingsStore((s) => s.reorderStyles);
  const reorderCharacters = useSettingsStore((s) => s.reorderCharacters);
  const semanticModelId = useEmbeddingStatusStore((s) => s.modelId);

  const handleToggleSemanticSearch = (enabled: boolean) => {
    setSemanticSearchEnabled(enabled);
    if (enabled) {
      enqueueMissingEmbeddings(semanticModelId);
      refreshEmbeddingCounts(semanticModelId);
    }
  };

  const [requestingPermission, setRequestingPermission] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return Notification.permission;
  });

  useEffect(() => {
    if (notificationPermission === "unsupported") return;
    const syncPermission = () => setNotificationPermission(Notification.permission);
    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);
    return () => {
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, [notificationPermission]);

  useEffect(() => {
    if (notificationPermission !== "granted" && desktopNotificationsEnabled) {
      setDesktopNotificationsEnabled(false);
    }
  }, [notificationPermission, desktopNotificationsEnabled, setDesktopNotificationsEnabled]);

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setRequestingPermission(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setNotificationPermission(nextPermission);
      if (nextPermission === "granted") setDesktopNotificationsEnabled(true);
      if (nextPermission === "denied") setDesktopNotificationsEnabled(false);
    } finally {
      setRequestingPermission(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleModelDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) reorderModels(active.id as string, over.id as string);
    },
    [reorderModels]
  );

  const handleUpscalerDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) reorderUpscalers(active.id as string, over.id as string);
    },
    [reorderUpscalers]
  );

  const handleStyleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) reorderStyles(active.id as string, over.id as string);
    },
    [reorderStyles]
  );

  const handleCharacterDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) reorderCharacters(active.id as string, over.id as string);
    },
    [reorderCharacters]
  );

  return (
    <main className="bg-surface flex h-full flex-1 flex-col overflow-hidden">
      <GalleryHeader title="Settings" />

      <div id="settings-scroll" className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* API Keys */}
        <section id="api-keys" className="group space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="text-accent-muted h-4 w-4" />
            <span className="text-sm font-medium">API Keys</span>
            {apiKeys.google && apiKeys.replicate && apiKeys.openai && (
              <Check className="h-4 w-4 text-green-500" />
            )}
          </div>

          <div className="space-y-3 pl-6">
            <p className="text-text-muted text-xs">Keys are stored locally in your browser.</p>
            {providers.map((provider) => (
              <ApiKeyInput
                key={provider.id}
                provider={provider.id}
                name={provider.name}
                description={provider.description}
                value={apiKeys[provider.id] || ""}
                onChange={(value) => setApiKey(provider.id, value || null)}
                link={provider.link}
              />
            ))}
          </div>
        </section>

        {/* Image Models */}
        <section id="image-models" className="group space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="text-accent-muted h-4 w-4" />
            <span className="text-sm font-medium">Image models</span>
          </div>

          <div className="space-y-1 pl-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleModelDragEnd}
            >
              <SortableContext
                items={models.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
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
          </div>
        </section>

        {/* Characters */}
        <section id="characters" className="group space-y-3">
          <div className="flex items-center gap-2">
            <Users className="text-accent-muted h-4 w-4" />
            <span className="text-sm font-medium">Characters</span>
          </div>

          <div className="space-y-1 pl-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleCharacterDragEnd}
            >
              <SortableContext
                items={characters.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
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
        </section>

        {/* Styles */}
        <section id="styles" className="group space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="text-accent-muted h-4 w-4" />
            <span className="text-sm font-medium">Styles</span>
          </div>

          <div className="space-y-1 pl-6">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleStyleDragEnd}
            >
              <SortableContext
                items={styles.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {styles.map((style) => (
                    <SortableStyleItem key={style.id} style={style} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <AddCustomStyleButton />
          </div>
        </section>

        {/* Text Models */}
        <section id="text-models" className="group space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquareText className="text-accent-muted h-4 w-4" />
            <span className="text-sm font-medium">Text models</span>
          </div>

          <div className="space-y-3 pl-6">
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

            <div className="border-border-subtle bg-surface-raised/60 space-y-3 rounded-lg border p-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-text-secondary text-sm">Always rewrite prompt</span>
                <Switch
                  checked={alwaysImprovePromptEnabled}
                  onChange={(e) => setAlwaysImprovePromptEnabled(e.target.checked)}
                  aria-label="Toggle always rewrite prompt"
                />
              </label>
              <p className="text-text-muted text-xs">
                Silently pass every prompt through a text model before generation. Has the same
                effect as the "rewrite" button in input areas (and, if that button is used, this
                step is skipped). Your original prompt is preserved and shown as the primary prompt
                in the lightbox.
              </p>
            </div>
          </div>
        </section>

        {/* Gallery */}
        <section id="gallery" className="group space-y-3">
          <div className="flex items-center gap-2">
            <Image className="text-accent-muted h-4 w-4" />
            <span className="text-sm font-medium">Gallery</span>
          </div>

          <div className="pl-6">
            <div className="border-border-subtle bg-surface-raised/60 divide-border-subtle divide-y rounded-lg border">
              <div className="space-y-3 p-3">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary text-sm">Enable semantic image search</span>
                  <Switch
                    checked={semanticSearchEnabled}
                    onChange={(e) => handleToggleSemanticSearch(e.target.checked)}
                    aria-label="Toggle semantic image search"
                  />
                </label>
                <p className="text-text-muted text-xs">
                  Downloads a ~400MB model on first use and runs it locally. Embeddings are computed
                  in the background while you wait for generations and let you search by image
                  content as well as prompt text. All processing stays in your browser.
                </p>
                {semanticSearchEnabled && <SemanticSearchStatus />}
              </div>

              <div className="space-y-3 p-3">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-text-secondary text-sm">
                    Notify when generations complete in background
                  </span>
                  <Switch
                    checked={desktopNotificationsEnabled && notificationPermission === "granted"}
                    disabled={notificationPermission !== "granted"}
                    onChange={(e) => setDesktopNotificationsEnabled(e.target.checked)}
                    aria-label="Toggle desktop notifications"
                  />
                </label>
                <p className="text-text-muted text-xs">
                  {notificationPermission === "unsupported"
                    ? "Desktop notifications are not supported in this browser."
                    : notificationPermission === "granted"
                      ? "Permission granted. You can toggle notifications on or off."
                      : notificationPermission === "denied"
                        ? "Permission is blocked. Enable notifications for this site in your browser settings."
                        : "Grant permission to enable completion notifications."}
                </p>
                {notificationPermission === "default" && (
                  <button
                    type="button"
                    onClick={requestNotificationPermission}
                    disabled={requestingPermission}
                    className="bg-surface-overlay text-text-secondary hover:bg-surface-interactive rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {requestingPermission ? "Requesting..." : "Request permission"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Editor */}
        <section id="editor" className="group space-y-3">
          <div className="flex items-center gap-2">
            <Expand className="text-accent-muted h-4 w-4" />
            <span className="text-sm font-medium">Editor</span>
          </div>

          <div className="space-y-3 pl-6">
            <div className="space-y-1">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleUpscalerDragEnd}
              >
                <SortableContext
                  items={upscalers.map((u) => u.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
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
              <AddCustomUpscalerButton />
            </div>

            <div className="border-border-subtle bg-surface-raised/60 space-y-3 rounded-lg border p-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-text-secondary text-sm">Editor context briefs</span>
                <Switch
                  checked={editorContextInjectionEnabled}
                  onChange={(e) => setEditorContextInjectionEnabled(e.target.checked)}
                  aria-label="Toggle editor context injection"
                />
              </label>
              <p className="text-text-muted text-xs">
                After each edit, an AI summary of your editing intent is generated and prepended to
                subsequent prompts. This helps maintain style and character consistency across
                multiple edits.
              </p>
            </div>
          </div>
        </section>

        {/* Data */}
        <DataSection />
      </div>
    </main>
  );
}

function DataSection() {
  const loadImages = useGalleryStore((s) => s.loadImages);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageCount, setImageCount] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    getImageCount().then(setImageCount);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      await exportAllImages();
      setStatus("Export complete.");
    } catch (e) {
      setStatus(`Export failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setStatus(null);
    try {
      const result = await importFromZip(file);
      const parts = [`${result.imported} generations imported`];
      if (result.referencesImported > 0)
        parts.push(`${result.referencesImported} references imported`);
      if (result.charactersImported > 0)
        parts.push(
          `${result.charactersImported} character${result.charactersImported !== 1 ? "s" : ""} imported`
        );
      if (result.stylesImported > 0)
        parts.push(
          `${result.stylesImported} custom style${result.stylesImported !== 1 ? "s" : ""} imported`
        );
      if (result.skipped > 0) parts.push(`${result.skipped} skipped (already exist)`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      setStatus(parts.join(", "));

      if (result.imported > 0) {
        await loadImages();
        setImageCount(await getImageCount());
      }
    } catch (e) {
      setStatus(`Import failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <section id="data" className="group space-y-3">
      <div className="flex items-center gap-2">
        <Archive className="text-accent-muted h-4 w-4" />
        <span className="text-sm font-medium">Data</span>
      </div>

      <div className="border-border-subtle bg-surface-raised/60 ml-6 space-y-3 rounded-lg border p-3">
        <p className="text-text-muted text-xs">
          Export or import all images, characters, and custom styles as a ZIP file.
          {imageCount !== null && (
            <span className="text-text-tertiary ml-1">
              {imageCount} image{imageCount !== 1 ? "s" : ""} in gallery.
            </span>
          )}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || importing || imageCount === 0}
            className="bg-surface-overlay text-text-secondary hover:bg-surface-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? "Exporting..." : "Export all images"}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={exporting || importing}
            className="bg-surface-overlay text-text-secondary hover:bg-surface-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {importing ? "Importing..." : "Import from ZIP"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleImport}
            className="hidden"
          />
        </div>

        {status && <p className="text-text-tertiary text-xs">{status}</p>}
      </div>
    </section>
  );
}

function ApiKeyInput({
  provider,
  name,
  description,
  value,
  onChange,
  link,
}: {
  provider: ApiKeyProvider;
  name: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  link: string;
}) {
  const [showKey, setShowKey] = useState(false);
  const hasKey = value.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-text-secondary text-sm font-medium">{name}</label>
          <p className="text-text-muted text-xs">
            {description} -
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-muted ml-1 hover:underline"
            >
              Get API key
            </a>
          </p>
        </div>
        {hasKey && <Check className="h-4 w-4 text-green-500" />}
      </div>
      <div className="relative">
        <input
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${name} API key`}
          className="border-c-border bg-surface-overlay text-text-primary placeholder-text-muted w-full rounded-lg border px-3 py-2 pr-10 text-sm transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="text-text-tertiary hover:text-text-secondary absolute top-1/2 right-2 -translate-y-1/2 p-1 transition-colors"
        >
          {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
