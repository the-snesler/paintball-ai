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
          className="z-50 min-h-9 max-h-72 overflow-y-auto rounded-lg border border-c-border bg-surface-raised py-1 shadow-xl"
          style={{ width: "var(--anchor-width)" }}
        >
          {isSearching && <p className="px-3 py-2 text-xs text-text-muted">Searching...</p>}

          {!isSearching && suggestions.length === 0 && showEmptyState && (
            <p className="px-3 py-2 text-xs text-text-muted">{emptyStateText}</p>
          )}

          {suggestions.map((item) => (
            <Combobox.Item
              key={getKey(item)}
              value={getValue(item)}
              className="flex w-full cursor-default items-center gap-2.5 px-3 py-2 text-left outline-none data-highlighted:bg-surface-overlay"
            >
              {renderItem(item)}
            </Combobox.Item>
          ))}
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}
