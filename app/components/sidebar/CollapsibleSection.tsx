import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

interface CollapsibleSectionProps {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  icon,
  title,
  badge,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="group mb-2 flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">{icon}</span>
          <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform duration-200 group-hover:text-zinc-400 ${
              !expanded ? "-rotate-90" : ""
            }`}
          />
        </div>
      </button>
      {expanded && children}
    </section>
  );
}
