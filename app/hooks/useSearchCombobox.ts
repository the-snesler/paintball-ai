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
  const [open, setOpenState] = useState(false);
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const requestIdRef = useRef(0);
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  const resetSearch = useCallback(() => {
    setOpenState(false);
    setSuggestions((prev) => (prev.length === 0 ? prev : []));
    setIsSearching(false);
  }, []);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setOpenState(false);
        return;
      }

      // Ignore open requests until the user has typed enough characters.
      if (!enabled || inputValue.trim().length < minChars) {
        return;
      }

      setOpenState(true);
    },
    [enabled, inputValue, minChars]
  );

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
        const results = await searchRef.current(query);
        if (requestIdRef.current !== currentRequestId) {
          return;
        }
        setSuggestions(results);
        setOpenState(true);
      } catch {
        if (requestIdRef.current !== currentRequestId) {
          return;
        }
        setSuggestions([]);
        setOpenState(true);
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsSearching(false);
        }
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [debounceMs, enabled, inputValue, minChars, resetSearch]);

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
