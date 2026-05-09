import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useImproveText } from "~/hooks/useImproveText";
import { getReferenceImagesByIds, saveReferenceImage } from "~/lib/db";
import { IMPROVE_STYLE_SYSTEM } from "~/lib/prompts";
import { isTextModelAvailable } from "~/lib/textModel";
import { ImproveTextButton } from "../ui/ImproveTextButton";

export type StyleFormData = {
  name: string;
  text: string;
  referenceImageId: string | undefined;
};

export default function StyleForm({
  initial,
  submitLabel,
  submitIcon,
  onSubmit,
  onCancel,
  autoFocusName,
}: {
  initial?: { name: string; text: string; referenceImageId?: string };
  submitLabel: string;
  submitIcon?: ReactNode;
  onSubmit: (data: StyleFormData) => Promise<void> | void;
  onCancel: () => void;
  autoFocusName?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [text, setText] = useState(initial?.text ?? "");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [existingBlob, setExistingBlob] = useState<Blob | null>(null);
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!autoFocusName) return;
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [autoFocusName]);

  useEffect(() => {
    const id = initial?.referenceImageId;
    if (!id) return;
    let active = true;
    let createdUrl: string | null = null;
    getReferenceImagesByIds([id]).then(([img]) => {
      if (!active) return;
      if (img) {
        createdUrl = img.url;
        setExistingBlob(img.blob);
        setExistingUrl(img.url);
      }
    });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [initial?.referenceImageId]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const hasExisting = !!initial?.referenceImageId;
  const showingExisting = hasExisting && !removeImage && !pendingFile;

  const improve = useImproveText({
    systemPrompt: IMPROVE_STYLE_SYSTEM,
    text,
    setText,
    getImages: () => {
      if (pendingFile) return [pendingFile];
      if (existingBlob && showingExisting) return [existingBlob];
      return undefined;
    },
  });

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

  const handleSubmit = async () => {
    if (!name.trim() || !text.trim()) {
      setError("Name and text are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let referenceImageId: string | undefined;
      if (pendingFile) {
        const id = crypto.randomUUID();
        await saveReferenceImage({ id, blob: pendingFile, name: pendingFile.name });
        referenceImageId = id;
      } else if (removeImage) {
        referenceImageId = undefined;
      } else {
        referenceImageId = initial?.referenceImageId;
      }
      await onSubmit({ name: name.trim(), text, referenceImageId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const replaceLabel = pendingFile || showingExisting ? "Replace" : "Add image";

  return (
    <div className="border-c-border/50 bg-surface-overlay/50 space-y-2 rounded-lg border p-3">
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
      <div className="flex justify-end">
        <ImproveTextButton
          isImproving={improve.isImproving}
          hasUndo={improve.hasUndo}
          onImprove={improve.improve}
          onUndo={improve.undo}
          canImprove={isTextModelAvailable() && text.trim().length > 0}
        />
      </div>
      <div className="flex items-center gap-2">
        {pendingPreviewUrl ? (
          <img
            src={pendingPreviewUrl}
            alt=""
            className="border-c-border/50 h-12 w-12 shrink-0 rounded-lg border object-cover"
          />
        ) : showingExisting && existingUrl ? (
          <img
            src={existingUrl}
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
          {replaceLabel}
        </button>
        {(showingExisting || pendingFile) && (
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
          onClick={handleSubmit}
          disabled={saving || !name.trim() || !text.trim()}
          className="bg-purple-600 text-white hover:bg-purple-500 disabled:bg-surface-interactive disabled:text-text-muted flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          {saving && submitIcon ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            submitIcon
          )}
          {saving ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-surface-interactive text-text-secondary hover:bg-c-border rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
