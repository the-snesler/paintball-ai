import { useCallback, useEffect, useRef, useState } from "react";

interface UseSearchComboboxOptions<T> {
  search: (query: string) => Promise<T[]>;
  enabled?: boolean;
  minChars?: number;
  debounceMs?: number;
}

export function useSearchCombobox<T>({
  search,
  enabled = true,
  minChars = 2,
  debounceMs = 300,
}: UseSearchComboboxOptions<T>) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const requestIdRef = useRef(0);

  const resetSearch = useCallback(() => {
    setOpen(false);
    setSuggestions([]);
    setIsSearching(false);
  }, []);

  useEffect(() => {
    const query = inputValue.trim();

    if (!enabled || query.length < minChars) {
      requestIdRef.current += 1;
      resetSearch();
      return;
    }

    const currentRequestId = requestIdRef.current + 1;
    requestIdRef.current = currentRequestId;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await search(query);
        if (requestIdRef.current !== currentRequestId) {
          return;
        }
        setSuggestions(results);
        setOpen(true);
      } catch {
        if (requestIdRef.current !== currentRequestId) {
          return;
        }
        setSuggestions([]);
        setOpen(true);
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsSearching(false);
        }
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [debounceMs, enabled, inputValue, minChars, resetSearch, search]);

  return {
    inputValue,
    setInputValue,
    open,
    setOpen,
    suggestions,
    isSearching,
    resetSearch,
    setSuggestions,
  };
}
