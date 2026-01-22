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
        className="flex items-center justify-between w-full mb-2 group"
      >
        <div className="flex items-center gap-2">
          <span className="text-zinc-500">{icon}</span>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          <ChevronDown 
            className={`w-4 h-4 text-zinc-500 group-hover:text-zinc-400 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      {expanded && children}
    </section>
  );
}
