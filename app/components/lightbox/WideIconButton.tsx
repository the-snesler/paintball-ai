import type React from "react";
import clsx from "clsx";
import { Tooltip } from "../ui/Tooltip";

export function WideIconButton({
  icon,
  title,
  tooltip,
  onClick,
  textBreakpoint,
  disabled = false,
  variant = "default",
}: {
  icon: React.ReactNode;
  title: string;
  tooltip?: React.ReactNode;
  onClick: () => void;
  textBreakpoint?: "sm" | "md" | "lg";
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  const content = (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      className={`flex items-center gap-1 rounded-lg p-2 transition-colors ${
        disabled
          ? "text-text-muted cursor-not-allowed"
          : variant === "danger"
            ? "text-red-400 hover:bg-red-500/10"
            : "text-text-secondary hover:bg-surface-overlay"
      }`}
    >
      {icon}
      <span
        className={clsx("text-xs leading-none", {
          "sm:inline": textBreakpoint === "sm",
          "md:inline": textBreakpoint === "md",
          "lg:inline": textBreakpoint === "lg",
          hidden: textBreakpoint,
        })}
      >
        {title}
      </span>
    </button>
  );
  if (!tooltip) return content;
  return (
    <Tooltip content={tooltip} placement="top" delay={200}>
      {content}
    </Tooltip>
  );
}
