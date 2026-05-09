import { Palette, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Switch } from "~/components/ui/Switch";
import { getReferenceImagesByIds } from "~/lib/db";
import { useSettingsStore } from "~/stores/settingsStore";
import type { StoredStyle } from "~/types";
import { Tooltip } from "../ui/Tooltip";
import StyleForm from "./StyleForm";

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

  if (editing) {
    return (
      <StyleForm
        initial={{ name: style.name, text: style.text, referenceImageId: style.referenceImageId }}
        submitLabel="Save"
        onSubmit={({ name, text, referenceImageId }) => {
          const patch: Parameters<typeof updateStyle>[1] = { name, text };
          if (referenceImageId !== style.referenceImageId) {
            patch.referenceImageId = referenceImageId;
          }
          updateStyle(style.id, patch);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
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
          onClick={() => setEditing(true)}
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
