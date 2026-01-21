import { Droplet, Menu } from "lucide-react";
import { SIDEBAR_POPOVER_ID } from "./Sidebar";

export function MobileHeader() {
  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
          <Droplet className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h1 className="font-semibold text-sm">Paintball</h1>
          <p className="text-xs text-zinc-500">AI Image Generation</p>
        </div>
      </div>
      <button
        popoverTarget={SIDEBAR_POPOVER_ID}
        className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-zinc-400" />
      </button>
    </header>
  );
}
