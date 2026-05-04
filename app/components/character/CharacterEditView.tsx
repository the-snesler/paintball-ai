import {
  ArrowLeft,
  ClipboardList,
  ImagePlus,
  Images,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { executeGeneration } from "~/lib/generation";
import { deleteReferenceImagesByIds, getReferenceImagesByIds, saveReferenceImage } from "~/lib/db";
import { getModel } from "~/lib/models";
import {
  CHARACTER_DESCRIPTION_FROM_REFERENCES_SYSTEM,
  CHARACTER_REFERENCE_IMAGE_SYSTEM,
} from "~/lib/prompts";
import { providerRequiresApiKey } from "~/lib/providers";
import { callTextModel } from "~/lib/textModel";
import { useGalleryStore } from "~/stores/galleryStore";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";
import type { CompletedGalleryItem } from "~/types";

interface LocalRef {
  id: string;
  blob: Blob;
  url: string;
  isNew: boolean;
}

type CharacterCreateMode = "references" | "form" | "manual";

interface CharacterFormState {
  name: string;
  age: string;
  presentation: string;
  eyeColor: string;
  build: string;
  nationality: string;
  ethnicity: string;
  height: string;
  hairStyle: string;
  hairColor: string;
  skinTone: string;
  clothingStyle: string;
}

const DEFAULT_FORM_STATE: CharacterFormState = {
  name: "",
  age: "",
  presentation: "",
  eyeColor: "",
  build: "",
  nationality: "",
  ethnicity: "",
  height: "",
  hairStyle: "",
  hairColor: "",
  skinTone: "",
  clothingStyle: "",
};

const FORM_OPTIONS: Record<keyof Omit<CharacterFormState, "name" | "clothingStyle">, string[]> = {
  age: ["child", "teenager", "young adult", "adult", "middle-aged", "elderly"],
  presentation: ["androgynous", "female-presenting", "male-presenting", "nonbinary"],
  eyeColor: ["brown", "blue", "green", "hazel", "gray", "amber", "dark"],
  build: ["slim", "athletic", "average", "muscular", "curvy", "stocky", "soft"],
  nationality: [
    "American",
    "Brazilian",
    "British",
    "Canadian",
    "Chinese",
    "French",
    "Indian",
    "Japanese",
    "Korean",
    "Mexican",
  ],
  ethnicity: [
    "Black",
    "East Asian",
    "Latine",
    "Middle Eastern",
    "South Asian",
    "Southeast Asian",
    "White",
    "mixed ethnicity",
  ],
  height: ["short", "average height", "tall", "very tall"],
  hairStyle: [
    "buzz cut",
    "short and neat",
    "bob",
    "shoulder-length",
    "long and wavy",
    "curly",
    "coily",
    "braided",
    "ponytail",
    "bald",
  ],
  hairColor: ["black", "brown", "blonde", "red", "auburn", "gray", "white", "pastel", "dyed"],
  skinTone: ["fair", "light", "medium", "olive", "tan", "brown", "dark"],
};

function buildCharacterFormDescription(form: CharacterFormState): string {
  const parts = [
    form.name.trim() ? `${form.name.trim()} is` : "The character is",
    form.age.trim(),
    form.presentation.trim(),
    form.height.trim(),
    form.build.trim() ? `with a ${form.build.trim()} build` : "",
    form.skinTone.trim() ? `${form.skinTone.trim()} skin` : "",
    form.eyeColor.trim() ? `${form.eyeColor.trim()} eyes` : "",
    form.hairColor.trim() || form.hairStyle.trim()
      ? `${[form.hairColor.trim(), form.hairStyle.trim()].filter(Boolean).join(" ")} hair`
      : "",
    form.ethnicity.trim() ? `${form.ethnicity.trim()} appearance` : "",
    form.nationality.trim() ? `${form.nationality.trim()} background` : "",
  ].filter(Boolean);

  const description = parts.join(", ").replace(" is,", " is");
  const clothing = form.clothingStyle.trim();
  return clothing ? `${description}. Usual clothing/style: ${clothing}.` : `${description}.`;
}

function FieldWithOptions({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const listId = `character-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label className="text-text-tertiary mb-1.5 block text-xs font-medium tracking-wide uppercase">
        {label}
      </label>
      <input
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Choose or type"
        className="border-c-border bg-surface-overlay text-text-primary placeholder-text-muted w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}

function RefTile({ ref: localRef, onRemove }: { ref: LocalRef; onRemove: (id: string) => void }) {
  return (
    <div className="group relative aspect-square">
      <img
        src={localRef.url}
        alt=""
        className="border-c-border/50 h-full w-full rounded-lg border object-cover"
      />
      <button
        type="button"
        onClick={() => onRemove(localRef.id)}
        className="border-c-border bg-surface-raised absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="text-text-tertiary h-3 w-3" />
      </button>
    </div>
  );
}

function RecentGalleryStrip({ onAdd }: { onAdd: (item: CompletedGalleryItem) => void }) {
  const items = useGalleryStore((s) => s.items);
  const recent = items
    .filter((i): i is CompletedGalleryItem => i.status === "completed")
    .slice(0, 20);

  if (recent.length === 0) return null;

  const handleDragStart = (e: React.DragEvent, item: CompletedGalleryItem) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        id: item.id,
        imageId: item.id,
        blob: item.originalUrl,
        name: `${item.modelName} - ${item.prompt.slice(0, 30)}`,
      })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div>
      <p className="text-text-muted mb-2 text-xs">Recent generations — click or drag to add</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {recent.map((item) => (
          <button
            key={item.id}
            type="button"
            draggable
            onDragStart={(e) => handleDragStart(e, item)}
            onClick={() => onAdd(item)}
            className="border-c-border/50 h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-opacity hover:opacity-80"
          >
            <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function CharacterEditView() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const characters = useSettingsStore((s) => s.characters);
  const addCharacter = useSettingsStore((s) => s.addCharacter);
  const updateCharacter = useSettingsStore((s) => s.updateCharacter);
  const removeCharacter = useSettingsStore((s) => s.removeCharacter);
  const models = useSettingsStore((s) => s.models);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const currentModelSelections = useGenerationStore((s) => s.currentModelSelections);
  const currentAspectRatio = useGenerationStore((s) => s.currentAspectRatio);
  const currentResolution = useGenerationStore((s) => s.currentResolution);
  const currentQuality = useGenerationStore((s) => s.currentQuality);

  const isNew = !id;
  const existing = id ? characters.find((c) => c.id === id) : null;

  const [mode, setMode] = useState<CharacterCreateMode>("references");
  const [name, setName] = useState(existing?.name ?? "");
  const [text, setText] = useState(existing?.text ?? "");
  const [refs, setRefs] = useState<LocalRef[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [form, setForm] = useState<CharacterFormState>(DEFAULT_FORM_STATE);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryItems = useGalleryStore((s) => s.items);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Load existing character refs on mount
  useEffect(() => {
    if (!existing?.referenceImageIds.length) return;
    let active = true;
    const createdUrls: string[] = [];
    getReferenceImagesByIds(existing.referenceImageIds).then((loaded) => {
      if (!active) return;
      const localRefs: LocalRef[] = loaded.map((r) => {
        createdUrls.push(r.url);
        return { id: r.id, blob: r.blob, url: r.url, isNew: false };
      });
      setRefs(localRefs);
    });
    return () => {
      active = false;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke new object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addRefBlob = useCallback((blob: Blob, name: string = "image") => {
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(blob);
    objectUrlsRef.current.add(url);
    setRefs((prev) => [...prev, { id, blob, url, isNew: true }]);
    void saveReferenceImage({ id, blob, name });
  }, []);

  const addGalleryItem = useCallback((item: CompletedGalleryItem) => {
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(item.originalBlob);
    objectUrlsRef.current.add(url);
    setRefs((prev) => [...prev, { id, blob: item.originalBlob, url, isNew: true }]);
    void saveReferenceImage({
      id,
      blob: item.originalBlob,
      name: item.modelName,
      sourceGalleryItemId: item.id,
    });
  }, []);

  const removeRef = useCallback((refId: string) => {
    setRefs((prev) => {
      const target = prev.find((r) => r.id === refId);
      if (target) {
        if (target.isNew) {
          URL.revokeObjectURL(target.url);
          objectUrlsRef.current.delete(target.url);
          void deleteReferenceImagesByIds([refId]);
        } else {
          setRemovedIds((ids) => [...ids, refId]);
        }
      }
      return prev.filter((r) => r.id !== refId);
    });
  }, []);

  const handleFiles = useCallback(
    (files: File[]) => {
      files.filter((f) => f.type.startsWith("image/")).forEach((f) => addRefBlob(f, f.name));
    },
    [addRefBlob]
  );

  const generateCharacterReference = useCallback(
    async (description: string, referenceImages: LocalRef[] = []) => {
      const selectedModelId = Object.entries(currentModelSelections).find(
        ([, count]) => count > 0
      )?.[0];
      if (!selectedModelId) {
        throw new Error("Select an image model in the sidebar first");
      }

      const model = getModel(models, selectedModelId);
      if (!model) {
        throw new Error("Selected image model is no longer available");
      }

      const requiresApiKey = providerRequiresApiKey(model.provider);
      const apiKey =
        requiresApiKey && model.provider !== "debug" ? apiKeys[model.provider] : undefined;
      if (requiresApiKey && !apiKey) {
        throw new Error(`No API key for ${model.provider}`);
      }

      const supportedRatios = model.capabilities.supportedAspectRatios;
      const aspectRatio =
        model.capabilities.supportsAspectRatios && currentAspectRatio
          ? supportedRatios &&
            supportedRatios.length > 0 &&
            !supportedRatios.includes(currentAspectRatio)
            ? null
            : currentAspectRatio
          : null;

      const results = await executeGeneration(
        {
          modelId: model.id,
          provider: model.provider,
          prompt: `${CHARACTER_REFERENCE_IMAGE_SYSTEM}\n\nCharacter description:\n${description}`,
          aspectRatio,
          resolution: model.capabilities.supportsResolution ? currentResolution : null,
          quality: model.capabilities.supportsQuality ? currentQuality : null,
          numberOfImages: 1,
          referenceImages: model.capabilities.supportsReferenceImages
            ? referenceImages.slice(0, model.capabilities.maxReferenceImages).map((r) => ({
                id: r.id,
                blob: r.blob,
              }))
            : [],
        },
        apiKey ?? undefined
      );

      const result = results[0];
      if (!result) {
        throw new Error("Image model did not return a character reference");
      }
      addRefBlob(result.blob, "Generated character reference");
    },
    [
      addRefBlob,
      apiKeys,
      currentAspectRatio,
      currentModelSelections,
      currentQuality,
      currentResolution,
      models,
    ]
  );

  const handleGenerateFromReferences = async () => {
    if (refs.length === 0) {
      setError("Add at least one reference photo first");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const description = await callTextModel(
        CHARACTER_DESCRIPTION_FROM_REFERENCES_SYSTEM,
        "Write a reusable character description from these reference images.",
        refs.map((r) => r.blob)
      );
      setText(description.trim());
      if (!name.trim()) setName("New character");
      await generateCharacterReference(description.trim(), refs);
      setMode("manual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate character");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFromForm = async () => {
    const description = buildCharacterFormDescription(form);
    if (description === "The character is.") {
      setError("Fill out at least one character detail first");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      if (form.name.trim()) setName(form.name.trim());
      setText(description);
      await generateCharacterReference(description);
      setMode("manual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate character reference");
    } finally {
      setGenerating(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const jsonData = e.dataTransfer.getData("application/json");
      if (jsonData) {
        try {
          const {
            imageId,
            blob: blobUrl,
            name: imgName,
          } = JSON.parse(jsonData) as {
            imageId?: string;
            blob?: string;
            name?: string;
          };
          if (imageId) {
            const galleryItem = galleryItems.find(
              (i) => i.id === imageId && i.status === "completed"
            ) as CompletedGalleryItem | undefined;
            if (galleryItem) {
              addGalleryItem(galleryItem);
              return;
            }
          }
          if (blobUrl) {
            fetch(blobUrl)
              .then((r) => r.blob())
              .then((b) => addRefBlob(b, imgName ?? "image"));
          }
        } catch {
          // ignore invalid payloads
        }
      }

      handleFiles(Array.from(e.dataTransfer.files));
    },
    [handleFiles, addRefBlob, addGalleryItem, galleryItems]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      for (const item of e.clipboardData.items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file?.type.startsWith("image/")) addRefBlob(file, file.name);
        }
      }
    },
    [addRefBlob]
  );

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (removedIds.length > 0) {
        await deleteReferenceImagesByIds(removedIds);
      }
      const refIds = refs.map((r) => r.id);
      if (isNew) {
        addCharacter({ name: name.trim(), text: text.trim(), referenceImageIds: refIds });
      } else if (existing) {
        updateCharacter(existing.id, {
          name: name.trim(),
          text: text.trim(),
          referenceImageIds: refIds,
        });
      }
      navigate("/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    removeCharacter(existing.id);
    navigate("/settings");
  };

  const referenceImagesSection = (
    <div>
      <label className="text-text-tertiary mb-2 block text-xs font-medium tracking-wide uppercase">
        Reference images
      </label>
      <div
        onDrop={handleDrop}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        className={`min-h-20 rounded-lg border-2 border-dashed p-3 transition-colors ${
          isDragOver ? "border-purple-500 bg-purple-500/10" : "border-c-border"
        }`}
      >
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {refs.map((r) => (
            <RefTile key={r.id} ref={r} onRemove={removeRef} />
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="border-c-border text-text-muted hover:text-text-secondary hover:border-text-muted flex aspect-square items-center justify-center rounded-lg border border-dashed transition-colors"
            title="Add image"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
        </div>
        {refs.length === 0 && !isDragOver && (
          <p className="text-text-muted mt-2 text-center text-xs">
            Drop images here, paste, or click + to add
          </p>
        )}
      </div>
    </div>
  );

  const manualContent = (
    <>
      <div className="space-y-4">
        <div>
          <label className="text-text-tertiary mb-1.5 block text-xs font-medium tracking-wide uppercase">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Character name"
            className="border-c-border bg-surface-overlay text-text-primary placeholder-text-muted w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-text-tertiary mb-1.5 block text-xs font-medium tracking-wide uppercase">
            Prompt text
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Text appended to your prompt when this character is selected (optional)"
            className="border-c-border bg-surface-overlay text-text-primary placeholder-text-muted w-full resize-y rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          />
        </div>
      </div>

      {referenceImagesSection}
      <RecentGalleryStrip onAdd={addGalleryItem} />
    </>
  );

  const referencesContent = (
    <>
      <div className="space-y-3">
        <div>
          <h2 className="text-text-primary text-sm font-medium">Character from references</h2>
          <p className="text-text-muted mt-1 text-xs">
            Add photos, then generate a reusable description and one clean reference image.
          </p>
        </div>
        {referenceImagesSection}
        <RecentGalleryStrip onAdd={addGalleryItem} />
        <button
          type="button"
          onClick={handleGenerateFromReferences}
          disabled={generating}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {generating ? "Generating..." : "Generate character"}
        </button>
      </div>
    </>
  );

  const formContent = (
    <>
      <div>
        <h2 className="text-text-primary text-sm font-medium">Character from form</h2>
        <p className="text-text-muted mt-1 text-xs">
          Pick from the suggestions or type custom values; the description is built directly from
          your entries.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-text-tertiary mb-1.5 block text-xs font-medium tracking-wide uppercase">
            Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Character name"
            className="border-c-border bg-surface-overlay text-text-primary placeholder-text-muted w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          />
        </div>
        <FieldWithOptions
          label="Age"
          value={form.age}
          options={FORM_OPTIONS.age}
          onChange={(value) => setForm((prev) => ({ ...prev, age: value }))}
        />
        <FieldWithOptions
          label="Presentation"
          value={form.presentation}
          options={FORM_OPTIONS.presentation}
          onChange={(value) => setForm((prev) => ({ ...prev, presentation: value }))}
        />
        <FieldWithOptions
          label="Eye color"
          value={form.eyeColor}
          options={FORM_OPTIONS.eyeColor}
          onChange={(value) => setForm((prev) => ({ ...prev, eyeColor: value }))}
        />
        <FieldWithOptions
          label="Build"
          value={form.build}
          options={FORM_OPTIONS.build}
          onChange={(value) => setForm((prev) => ({ ...prev, build: value }))}
        />
        <FieldWithOptions
          label="Nationality"
          value={form.nationality}
          options={FORM_OPTIONS.nationality}
          onChange={(value) => setForm((prev) => ({ ...prev, nationality: value }))}
        />
        <FieldWithOptions
          label="Ethnicity"
          value={form.ethnicity}
          options={FORM_OPTIONS.ethnicity}
          onChange={(value) => setForm((prev) => ({ ...prev, ethnicity: value }))}
        />
        <FieldWithOptions
          label="Height"
          value={form.height}
          options={FORM_OPTIONS.height}
          onChange={(value) => setForm((prev) => ({ ...prev, height: value }))}
        />
        <FieldWithOptions
          label="Hair style"
          value={form.hairStyle}
          options={FORM_OPTIONS.hairStyle}
          onChange={(value) => setForm((prev) => ({ ...prev, hairStyle: value }))}
        />
        <FieldWithOptions
          label="Hair color"
          value={form.hairColor}
          options={FORM_OPTIONS.hairColor}
          onChange={(value) => setForm((prev) => ({ ...prev, hairColor: value }))}
        />
        <FieldWithOptions
          label="Skin tone"
          value={form.skinTone}
          options={FORM_OPTIONS.skinTone}
          onChange={(value) => setForm((prev) => ({ ...prev, skinTone: value }))}
        />
        <div className="sm:col-span-2">
          <label className="text-text-tertiary mb-1.5 block text-xs font-medium tracking-wide uppercase">
            Clothing/style notes
          </label>
          <textarea
            value={form.clothingStyle}
            onChange={(e) => setForm((prev) => ({ ...prev, clothingStyle: e.target.value }))}
            rows={3}
            placeholder="Wardrobe, vibe, era, accessories, or other visual notes"
            className="border-c-border bg-surface-overlay text-text-primary placeholder-text-muted w-full resize-y rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={handleGenerateFromForm}
        disabled={generating}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4" />
        {generating ? "Generating..." : "Generate reference"}
      </button>
    </>
  );

  return (
    <div className="flex h-full grow flex-col overflow-y-auto">
      <div className="border-border-subtle flex items-center gap-3 border-b px-6 py-4">
        <Link
          to="/settings"
          className="text-text-muted hover:text-text-secondary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-sm font-semibold">
          {isNew ? "New character" : `Edit ${existing?.name ?? "character"}`}
        </h1>
        {isNew && (
          <div className="border-c-border bg-surface-overlay ml-auto flex rounded-lg border p-1">
            {[
              { id: "references" as const, label: "From references", icon: Images },
              { id: "form" as const, label: "From form", icon: ClipboardList },
              { id: "manual" as const, label: "Manual", icon: Pencil },
            ].map((item) => {
              const Icon = item.icon;
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMode(item.id);
                    setError(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-purple-600 text-white"
                      : "text-text-muted hover:bg-surface-interactive hover:text-text-secondary"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6" onPaste={handlePaste}>
        {isNew && mode === "references" && referencesContent}
        {isNew && mode === "form" && formContent}
        {(!isNew || mode === "manual") && manualContent}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Footer actions */}
        <div className="mt-auto flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || generating}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <Link
            to="/settings"
            className="bg-surface-interactive text-text-secondary hover:bg-c-border rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
          {!isNew && existing && (
            <button
              type="button"
              onClick={handleDelete}
              className="text-text-muted rounded-lg p-2 transition-colors hover:bg-red-900/30 hover:text-red-400"
              title="Delete character"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
