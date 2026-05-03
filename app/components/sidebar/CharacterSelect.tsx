import { Select } from "@base-ui/react/select";
import { Check, ChevronDown, User } from "lucide-react";
import { useGenerationStore } from "~/stores/generationStore";
import { useSettingsStore } from "~/stores/settingsStore";

export function CharacterSelect() {
  const characters = useSettingsStore((s) => s.characters);
  const characterId = useGenerationStore((s) => s.currentCharacterId);
  const setCharacterId = useGenerationStore((s) => s.setCharacterId);

  const enabledCharacters = characters.filter((c) => c.enabled);
  const selected = characterId ? enabledCharacters.find((c) => c.id === characterId) : null;

  return (
    <Select.Root<string | null>
      value={characterId}
      onValueChange={(value) => setCharacterId(value ?? null)}
    >
      <Select.Trigger className="text-text-tertiary hover:text-text-secondary inline-flex max-w-full items-center gap-1 truncate text-xs transition-colors cursor-pointer">
        <User className="h-3.5 w-3.5 shrink-0" />
        <Select.Value className="truncate">{selected?.name ?? "Character"}</Select.Value>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} className="z-50">
          <Select.Popup className="bg-surface-overlay border-c-border max-h-72 min-w-48 overflow-y-auto rounded-lg border p-1 text-sm shadow-lg animate-in fade-in zoom-in-95">
            <Select.Item
              value={null}
              className="text-text-secondary data-highlighted:bg-surface-raised flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none"
            >
              <span className="flex h-3 w-3 items-center justify-center">
                <Select.ItemIndicator>
                  <Check className="h-3 w-3" />
                </Select.ItemIndicator>
              </span>
              <Select.ItemText>None</Select.ItemText>
            </Select.Item>
            {enabledCharacters.map((character) => (
              <Select.Item
                key={character.id}
                value={character.id}
                className="text-text-secondary data-highlighted:bg-surface-raised flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none"
              >
                <span className="flex h-3 w-3 items-center justify-center">
                  <Select.ItemIndicator>
                    <Check className="h-3 w-3" />
                  </Select.ItemIndicator>
                </span>
                <Select.ItemText>{character.name}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
