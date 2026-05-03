import { ArrowLeft, ImagePlus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getReferenceImagesByIds, saveReferenceImage, deleteReferenceImagesByIds } from "~/lib/db";
import { useGalleryStore } from "~/stores/galleryStore";
import { useSettingsStore } from "~/stores/settingsStore";
import type { CompletedGalleryItem } from "~/types";

interface LocalRef {
  id: string;
  blob: Blob;
  url: string;
  isNew: boolean;
}

function RefTile({
  ref: localRef,
  onRemove,
}: {
  ref: LocalRef;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="group relative aspect-square">
      <img
        src={localRef.url}
        alt=""
        className="h-full w-full rounded-lg object-cover border border-c-border/50"
      />
      <button
        type="button"
        onClick={() => onRemove(localRef.id)}
        className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-c-border bg-surface-raised opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="h-3 w-3 text-text-tertiary" />
      </button>
    </div>
  );
}

function RecentGalleryStrip({
  onAdd,
}: {
  onAdd: (item: CompletedGalleryItem) => void;
}) {
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
            className="shrink-0 h-16 w-16 overflow-hidden rounded-lg border border-c-border/50 transition-opacity hover:opacity-80"
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

  const isNew = !id;
  const existing = id ? characters.find((c) => c.id === id) : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [text, setText] = useState(existing?.text ?? "");
  const [refs, setRefs] = useState<LocalRef[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryItems = useGalleryStore((s) => s.items);

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
      refs.filter((r) => r.isNew).forEach((r) => URL.revokeObjectURL(r.url));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addRefBlob = useCallback((blob: Blob, name: string = "image") => {
    const id = crypto.randomUUID();
    const url = URL.createObjectURL(blob);
    setRefs((prev) => [...prev, { id, blob, url, isNew: true }]);
    void saveReferenceImage({ id, blob, name });
  }, []);

  const addGalleryItem = useCallback(
    (item: CompletedGalleryItem) => {
      const id = crypto.randomUUID();
      const url = URL.createObjectURL(item.originalBlob);
      setRefs((prev) => [...prev, { id, blob: item.originalBlob, url, isNew: true }]);
      void saveReferenceImage({ id, blob: item.originalBlob, name: item.modelName, sourceGalleryItemId: item.id });
    },
    []
  );

  const removeRef = useCallback((refId: string) => {
    setRefs((prev) => {
      const target = prev.find((r) => r.id === refId);
      if (target) {
        if (target.isNew) {
          URL.revokeObjectURL(target.url);
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const jsonData = e.dataTransfer.getData("application/json");
      if (jsonData) {
        try {
          const { imageId, blob: blobUrl, name: imgName } = JSON.parse(jsonData) as {
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

  return (
    <div className="flex h-full flex-col overflow-y-auto">
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
      </div>

      <div
        className="flex flex-1 flex-col gap-6 overflow-y-auto p-6"
        onPaste={handlePaste}
      >
        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-text-tertiary mb-1.5 block text-xs font-medium uppercase tracking-wide">
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
            <label className="text-text-tertiary mb-1.5 block text-xs font-medium uppercase tracking-wide">
              Prompt text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Text appended to your prompt when this character is selected (optional)"
              className="border-c-border bg-surface-overlay text-text-primary placeholder-text-muted w-full resize-y rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Reference images */}
        <div>
          <label className="text-text-tertiary mb-2 block text-xs font-medium uppercase tracking-wide">
            Reference images
          </label>
          <div
            onDrop={handleDrop}
            onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
            className={`min-h-20 rounded-lg border-2 border-dashed p-3 transition-colors ${
              isDragOver ? "border-purple-500 bg-purple-500/10" : "border-c-border"
            }`}
          >
            <div className="grid grid-cols-4 gap-2">
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
        </div>

        {/* Recent generations strip */}
        <RecentGalleryStrip onAdd={addGalleryItem} />

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Footer actions */}
        <div className="mt-auto flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <Link
            to="/settings"
            className="rounded-lg bg-surface-interactive px-4 py-2 text-center text-sm font-medium text-text-secondary transition-colors hover:bg-c-border"
          >
            Cancel
          </Link>
          {!isNew && existing && (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-red-900/30 hover:text-red-400"
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
