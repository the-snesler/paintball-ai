import { Droplet, Menu } from "lucide-react";
import { SIDEBAR_POPOVER_ID } from "./Sidebar";

export function MobileHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border-subtle bg-surface-raised px-4 py-3 md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-overlay">
          <Droplet className="h-4 w-4 text-accent-muted" />
        </div>
        <div>
          <h1 className="text-sm font-semibold">Paintball</h1>
          <p className="text-xs text-text-muted">AI Image Generation</p>
        </div>
      </div>
      <button
        popoverTarget={SIDEBAR_POPOVER_ID}
        className="rounded-lg p-2 transition-colors hover:bg-surface-overlay"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-text-tertiary" />
      </button>
    </header>
  );
}
