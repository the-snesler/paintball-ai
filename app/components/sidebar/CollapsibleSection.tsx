import { ChevronDown, Info } from "lucide-react";
import { type ReactNode } from "react";
import { Accordion } from "@base-ui/react/accordion";
import { Tooltip } from "../ui/Tooltip";

interface CollapsibleSectionProps {
  /** Unique identifier for this section within its parent Accordion.Root. */
  value: string;
  icon: ReactNode;
  title: string;
  tooltip?: string;
  badge?: ReactNode;
  children: ReactNode;
}

export function CollapsibleSection({
  value,
  icon,
  title,
  tooltip,
  badge,
  children,
}: CollapsibleSectionProps) {
  return (
    <Accordion.Item value={value}>
      <Accordion.Header>
        <Accordion.Trigger className="group mb-2 flex w-full cursor-pointer items-center">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">{icon}</span>
            <h2 className="text-text-tertiary text-xs font-medium tracking-wide uppercase">
              {title}
            </h2>
            {tooltip && (
              <Tooltip content={tooltip} placement="bottom-start">
                <span className="text-text-muted hover:text-text-tertiary cursor-help transition-colors">
                  <Info className="h-3 w-3" />
                </span>
              </Tooltip>
            )}
          </div>
          <div className="grow" />
          {badge}
          <ChevronDown className="text-text-muted group-hover:text-text-tertiary h-4 w-4 -rotate-90 transition-transform duration-200 group-data-panel-open:rotate-0" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0">
        {children}
      </Accordion.Panel>
    </Accordion.Item>
  );
}
