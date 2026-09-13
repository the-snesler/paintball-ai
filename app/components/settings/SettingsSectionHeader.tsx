import type { ComponentType } from "react";

export function SettingsSectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <Icon className="text-accent-muted h-4 w-4" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-text-muted mb-3 pl-6 text-xs">{subtitle}</p>
    </>
  );
}
