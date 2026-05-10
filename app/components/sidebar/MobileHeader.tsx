import { Droplet, Menu } from "lucide-react";
import { SIDEBAR_POPOVER_ID } from "./Sidebar";

export function MobileHeader() {
  return (
    <header className="border-border-subtle bg-surface-raised flex items-center justify-between border-b px-4 py-3 md:hidden">
      <div className="flex items-center gap-3">
        <div className="bg-surface-overlay flex h-8 w-8 items-center justify-center rounded-lg">
          <Droplet className="text-accent-muted h-4 w-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold">Paintball</h1>
          <p className="text-text-muted text-xs">AI Image Generation</p>
        </div>
      </div>
      <button
        popoverTarget={SIDEBAR_POPOVER_ID}
        className="hover:bg-surface-overlay rounded-lg p-2 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="text-text-tertiary h-5 w-5" />
      </button>
    </header>
  );
}
