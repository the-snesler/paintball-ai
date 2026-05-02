import { ImagePlus, Loader2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { saveReferenceImage } from "~/lib/db";
import { useSettingsStore } from "~/stores/settingsStore";

export default function AddCustomStyleButton() {
  const addCustomStyle = useSettingsStore((s) => s.addCustomStyle);

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isAdding) return;
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isAdding]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const reset = () => {
    setName("");
    setText("");
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
  };

  const handleFile = (next: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (next) {
      setFile(next);
      setPreviewUrl(URL.createObjectURL(next));
    } else {
      setFile(null);
      setPreviewUrl(null);
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !text.trim()) {
      setError("Name and text are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let referenceImageId: string | undefined;
      if (file) {
        referenceImageId = crypto.randomUUID();
        await saveReferenceImage({ id: referenceImageId, blob: file, name: file.name });
      }
      addCustomStyle({ name: name.trim(), text, referenceImageId });
      reset();
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add style");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="border-c-border text-text-tertiary hover:border-c-border hover:text-text-secondary flex w-full items-center gap-2 rounded-lg border border-dashed p-2.5 transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span className="text-sm">Add custom style</span>
      </button>
    );
  }

  return (
    <div className="border-c-border bg-surface-overlay/50 space-y-2 rounded-lg border p-3">
      <input
        ref={nameRef}
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
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="border-c-border/50 h-12 w-12 shrink-0 rounded-lg border object-cover"
          />
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
          {file ? "Replace" : "Add image (optional)"}
        </button>
        {file && (
          <button
            type="button"
            onClick={() => handleFile(null)}
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
          onClick={handleAdd}
          disabled={saving || !name.trim() || !text.trim()}
          className="bg-purple-600 text-white hover:bg-purple-500 disabled:bg-surface-interactive disabled:text-text-muted flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setIsAdding(false);
          }}
          disabled={saving}
          className="bg-surface-interactive text-text-secondary hover:bg-c-border rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
