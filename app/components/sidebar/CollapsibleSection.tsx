import { ChevronDown } from "lucide-react";
import { type ReactNode } from "react";
import { Accordion } from "@base-ui/react/accordion";

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
  return (
    <section>
      <Accordion.Root defaultValue={defaultExpanded ? [0] : []}>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger className="group mb-2 flex w-full cursor-pointer items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">{icon}</span>
                <h2 className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
                  {title}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {badge}
                <ChevronDown className="h-4 w-4 -rotate-90 text-zinc-500 transition-transform duration-200 group-hover:text-zinc-400 group-data-panel-open:rotate-0" />
              </div>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0">
            {children}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    </section>
  );
}
