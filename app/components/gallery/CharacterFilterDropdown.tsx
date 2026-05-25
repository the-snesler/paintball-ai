import { Select } from "@base-ui/react/select";
import { Check, ChevronDown, User } from "lucide-react";
import { useSettingsStore } from "~/stores/settingsStore";

interface CharacterFilterDropdownProps {
  value: string | null;
  onChange: (id: string | null) => void;
}

export function CharacterFilterDropdown({ value, onChange }: CharacterFilterDropdownProps) {
  const characters = useSettingsStore((s) => s.characters);

  if (characters.length === 0) return null;

  const selected = value ? characters.find((c) => c.id === value) : null;
  const isActive = value !== null;

  return (
    <Select.Root<string | null> value={value} onValueChange={(v) => onChange(v ?? null)}>
      <Select.Trigger
        title={
          isActive ? `Filtering by character: ${selected?.name ?? value}` : "Filter by character"
        }
        className={`flex h-8 cursor-pointer items-center gap-1 rounded-lg border px-2 text-xs transition-colors focus:outline-none ${
          isActive
            ? "border-purple-500/50 bg-purple-500/10 text-purple-300 hover:bg-purple-500/15"
            : "border-c-border bg-surface-raised text-text-tertiary hover:text-text-secondary"
        }`}
      >
        <User className="h-3.5 w-3.5 shrink-0" />
        <Select.Value className="max-w-24 truncate">{selected?.name ?? "Character"}</Select.Value>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} className="z-50">
          <Select.Popup className="bg-surface-overlay border-c-border animate-in fade-in zoom-in-95 max-h-72 min-w-40 overflow-y-auto rounded-lg border p-1 text-sm shadow-lg">
            <Select.Item
              value={null}
              className="text-text-secondary data-highlighted:bg-surface-raised flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none"
            >
              <span className="flex h-3 w-3 items-center justify-center">
                <Select.ItemIndicator>
                  <Check className="h-3 w-3" />
                </Select.ItemIndicator>
              </span>
              <Select.ItemText>All characters</Select.ItemText>
            </Select.Item>
            {characters.map((character) => (
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
