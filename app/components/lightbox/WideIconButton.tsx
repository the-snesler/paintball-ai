import type React from "react";
import { Tooltip } from "../ui/Tooltip";

export function WideIconButton({
  icon,
  title,
  tooltip,
  onClick,
  disabled = false,
  variant = "default",
}: {
  icon: React.ReactNode;
  title: string;
  tooltip?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  const content = (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      className={`rounded-lg p-2 transition-colors flex items-center gap-1 ${
        disabled
          ? "cursor-not-allowed text-zinc-600"
          : variant === "danger"
            ? "text-red-400 hover:bg-red-500/10"
            : "text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {icon}
      <span className="text-xs leading-none">{title}</span>
    </button>
  );
  if (!tooltip) return content;
  return (
    <Tooltip content={tooltip} placement="top" delay={200}>
      {content}
    </Tooltip>
  );
}
