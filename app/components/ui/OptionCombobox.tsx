import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface OptionComboboxProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function OptionCombobox({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose or type",
}: OptionComboboxProps) {
  const [open, setOpen] = useState(false);

  const query = value.trim().toLowerCase();
  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query))
    : options;

  return (
    <div>
      <label className="text-text-tertiary mb-1.5 block text-xs font-medium tracking-wide uppercase">
        {label}
      </label>
      <Combobox.Root
        open={open}
        onOpenChange={setOpen}
        inputValue={value}
        onInputValueChange={(val) => onChange(val)}
        filter={null}
      >
        <div className="relative">
          <Combobox.Input
            placeholder={placeholder}
            onClick={() => setOpen(true)}
            onFocus={() => setOpen(true)}
            className="border-c-border bg-surface-overlay text-text-primary placeholder-text-muted w-full rounded-lg border px-3 py-2 pr-8 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          />
          <ChevronDown
            className={`text-text-muted pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} align="start" className="z-50">
            <Combobox.Popup
              className="border-c-border bg-surface-overlay z-50 max-h-60 overflow-y-auto rounded-lg border py-1 shadow-xl"
              style={{ width: "var(--anchor-width)" }}
            >
              {filtered.length === 0 ? (
                <p className="text-text-muted px-3 py-2 text-xs">
                  No matches — keep typing to use a custom value
                </p>
              ) : (
                filtered.map((option) => (
                  <Combobox.Item
                    key={option}
                    value={option}
                    className="text-text-secondary data-highlighted:bg-surface-raised flex cursor-pointer items-center px-3 py-1.5 text-sm outline-none"
                  >
                    {option}
                  </Combobox.Item>
                ))
              )}
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}
