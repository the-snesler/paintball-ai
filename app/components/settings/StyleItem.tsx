import { ImagePlus, Palette, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Switch } from "~/components/ui/Switch";
import { getReferenceImagesByIds, saveReferenceImage } from "~/lib/db";
import { useSettingsStore } from "~/stores/settingsStore";
import type { StoredStyle } from "~/types";
import { Tooltip } from "../ui/Tooltip";

function StyleThumbnail({ referenceImageId }: { referenceImageId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    getReferenceImagesByIds([referenceImageId]).then(([img]) => {
      if (!active) return;
      if (img) {
        createdUrl = img.url;
        setUrl(img.url);
      } else {
        setUrl(null);
      }
    });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [referenceImageId]);

  if (!url) {
    return <div className="bg-surface-interactive h-7 w-7 shrink-0 rounded-lg" />;
  }

  return (
    <img
      src={url}
      alt=""
      className="border-c-border/50 h-7 w-7 shrink-0 rounded-lg border object-cover"
    />
  );
}

export default function StyleItem({
  style,
  dragHandleProps,
}: {
  style: StoredStyle;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const setStyleEnabled = useSettingsStore((s) => s.setStyleEnabled);
  const updateStyle = useSettingsStore((s) => s.updateStyle);
  const removeCustomStyle = useSettingsStore((s) => s.removeCustomStyle);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(style.name);
  const [text, setText] = useState(style.text);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const startEdit = () => {
    setName(style.name);
    setText(style.text);
    setPendingFile(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
    setRemoveImage(false);
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingPreviewUrl(null);
    setPendingFile(null);
    setRemoveImage(false);
  };

  const handleFile = (file: File | null) => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    if (file) {
      setPendingFile(file);
      setPendingPreviewUrl(URL.createObjectURL(file));
      setRemoveImage(false);
    } else {
      setPendingFile(null);
      setPendingPreviewUrl(null);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !text.trim()) {
      setError("Name and text are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patch: Parameters<typeof updateStyle>[1] = {
        name: name.trim(),
        text,
      };
      if (pendingFile) {
        const id = crypto.randomUUID();
        await saveReferenceImage({ id, blob: pendingFile, name: pendingFile.name });
        patch.referenceImageId = id;
      } else if (removeImage) {
        patch.referenceImageId = undefined;
      }
      updateStyle(style.id, patch);
      setEditing(false);
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(null);
      setPendingFile(null);
      setRemoveImage(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="border-c-border/50 bg-surface-overlay/50 space-y-2 rounded-lg border p-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Style name"
          className="border-c-border bg-surface-raised text-text-primary placeholder-text-muted w-full rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Text appended to your prompt. Use {n} to reference the attached image's position."
          className="border-c-border bg-surface-raised text-text-primary placeholder-text-muted w-full resize-y rounded-lg border px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          {pendingPreviewUrl ? (
            <img
              src={pendingPreviewUrl}
              alt=""
              className="border-c-border/50 h-12 w-12 shrink-0 rounded-lg border object-cover"
            />
          ) : !removeImage && style.referenceImageId ? (
            <StyleThumbnail referenceImageId={style.referenceImageId} />
          ) : (
            <div className="bg-surface-interactive flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
              <ImagePlus className="text-text-muted h-4 w-4" />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="bg-surface-interactive text-text-secondary hover:bg-c-border rounded-lg px-3 py-1.5 text-xs transition-colors"
          >
            {pendingFile ? "Replace" : style.referenceImageId && !removeImage ? "Replace" : "Add image"}
          </button>
          {(style.referenceImageId || pendingFile) && (
            <button
              type="button"
              onClick={() => {
                if (pendingFile) {
                  handleFile(null);
                  setRemoveImage(false);
                } else {
                  setRemoveImage(true);
                }
              }}
              className="text-text-muted hover:text-red-400 p-1 transition-colors"
              title="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-text-muted text-xs">
          Use <code className="bg-surface-raised rounded px-1">{"{n}"}</code> to reference the
          attached image's position. Stripped if no image is attached.
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 text-white hover:bg-purple-500 disabled:bg-surface-interactive disabled:text-text-muted flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={saving}
            className="bg-surface-interactive text-text-secondary hover:bg-c-border rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-c-border/50 bg-surface-overlay/50 flex items-center gap-1 rounded-lg border p-2 py-2.5">
      {dragHandleProps ? (
        <button
          {...dragHandleProps}
          className="text-text-muted hover:text-text-tertiary shrink-0 cursor-grab touch-none active:cursor-grabbing"
        >
          <div className="bg-surface-interactive text-text-tertiary mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            {style.referenceImageId ? (
              <StyleThumbnail referenceImageId={style.referenceImageId} />
            ) : (
              <Palette className="h-4 w-4" />
            )}
          </div>
        </button>
      ) : (
        <div className="bg-surface-interactive text-text-tertiary mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          {style.referenceImageId ? (
            <StyleThumbnail referenceImageId={style.referenceImageId} />
          ) : (
            <Palette className="h-4 w-4" />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-text-primary truncate text-sm font-medium">{style.name}</p>
        <Tooltip content={style.text} placement="bottom">
          <p className="text-text-muted truncate text-xs">{style.text}</p>
        </Tooltip>
      </div>
      {style.isCustom && (
        <button
          type="button"
          onClick={startEdit}
          className="text-text-muted hover:text-accent-muted shrink-0 p-1 transition-colors"
          title="Edit style"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {style.isCustom && (
        <button
          type="button"
          onClick={() => removeCustomStyle(style.id)}
          className="text-text-muted shrink-0 p-1 transition-colors hover:text-red-400"
          title="Remove style"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      <Switch
        checked={style.enabled}
        onChange={(e) => setStyleEnabled(style.id, e.target.checked)}
        aria-label={`Toggle ${style.name}`}
      />
    </div>
  );
}
