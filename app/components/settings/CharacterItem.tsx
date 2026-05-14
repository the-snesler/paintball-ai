import { Pencil, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Switch } from "~/components/ui/Switch";
import { getReferenceImagesByIds } from "~/lib/db";
import { useSettingsStore } from "~/stores/settingsStore";
import type { StoredCharacter } from "~/types";

function CharacterThumbnail({ referenceImageId }: { referenceImageId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    getReferenceImagesByIds([referenceImageId]).then(([img]) => {
      if (!active) return;
      if (img) {
        createdUrl = img.url;
        setUrl(img.url);
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

export default function CharacterItem({
  character,
  dragHandleProps,
}: {
  character: StoredCharacter;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const setCharacterEnabled = useSettingsStore((s) => s.setCharacterEnabled);
  const removeCharacter = useSettingsStore((s) => s.removeCharacter);

  const firstRefId = character.referenceImageIds[0];

  const icon = (
    <div className="bg-surface-interactive text-text-tertiary mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
      {firstRefId ? (
        <CharacterThumbnail referenceImageId={firstRefId} />
      ) : (
        <User className="h-4 w-4" />
      )}
    </div>
  );

  return (
    <div className="border-c-border/50 bg-surface-overlay/50 flex items-center gap-1 rounded-lg border p-2 py-2.5">
      {dragHandleProps ? (
        <button
          {...dragHandleProps}
          className="text-text-muted hover:text-text-tertiary shrink-0 cursor-grab touch-none active:cursor-grabbing"
        >
          {icon}
        </button>
      ) : (
        icon
      )}
      <div className="min-w-0 flex-1">
        <p className="text-text-primary truncate text-sm font-medium">{character.name}</p>
        {character.referenceImageIds.length > 0 && (
          <p className="text-text-muted text-xs">
            {character.referenceImageIds.length} ref
            {character.referenceImageIds.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
      <Link
        to={`/app/characters/${character.id}`}
        className="text-text-muted hover:text-accent-muted shrink-0 p-1 transition-colors"
        title="Edit character"
      >
        <Pencil className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={() => removeCharacter(character.id)}
        className="text-text-muted shrink-0 p-1 transition-colors hover:text-red-400"
        title="Remove character"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <Switch
        checked={character.enabled}
        onChange={(e) => setCharacterEnabled(character.id, e.target.checked)}
        aria-label={`Toggle ${character.name}`}
      />
    </div>
  );
}
