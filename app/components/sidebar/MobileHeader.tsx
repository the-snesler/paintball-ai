import { Droplet, Menu } from "lucide-react";
import { SIDEBAR_POPOVER_ID } from "./Sidebar";

export function MobileHeader() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3 md:hidden">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800">
          <Droplet className="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <h1 className="text-sm font-semibold">Paintball</h1>
          <p className="text-xs text-zinc-500">AI Image Generation</p>
        </div>
      </div>
      <button
        popoverTarget={SIDEBAR_POPOVER_ID}
        className="rounded-lg p-2 transition-colors hover:bg-zinc-800"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-zinc-400" />
      </button>
    </header>
  );
}
