import { Combobox } from "@base-ui/react/combobox";
import type { ReactNode } from "react";

interface SearchComboboxPopupProps<T> {
  suggestions: T[];
  isSearching: boolean;
  showEmptyState: boolean;
  emptyStateText: string;
  getKey: (item: T) => string;
  getValue: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}

export default function SearchComboboxPopup<T>({
  suggestions,
  isSearching,
  showEmptyState,
  emptyStateText,
  getKey,
  getValue,
  renderItem,
}: SearchComboboxPopupProps<T>) {
  return (
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4} align="start">
        <Combobox.Popup
          className="border-c-border bg-surface-raised z-50 max-h-72 min-h-9 overflow-y-auto rounded-lg border py-1 shadow-xl"
          style={{ width: "var(--anchor-width)" }}
        >
          {isSearching && <p className="text-text-muted px-3 py-2 text-xs">Searching...</p>}

          {!isSearching && suggestions.length === 0 && showEmptyState && (
            <p className="text-text-muted px-3 py-2 text-xs">{emptyStateText}</p>
          )}

          {suggestions.map((item) => (
            <Combobox.Item
              key={getKey(item)}
              value={getValue(item)}
              className="data-highlighted:bg-surface-overlay flex w-full cursor-default items-center gap-2.5 px-3 py-2 text-left outline-none"
            >
              {renderItem(item)}
            </Combobox.Item>
          ))}
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}
