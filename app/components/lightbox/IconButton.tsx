import { Tooltip } from "../ui/Tooltip";

export function IconButton({
  icon,
  title,
  onClick,
  disabled = false,
  variant = "default",
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  return (
    <Tooltip content={title} placement="top" delay={200}>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        className={`rounded-lg p-2 transition-colors ${disabled
          ? "text-text-muted cursor-not-allowed"
          : variant === "danger"
            ? "text-red-400 hover:bg-red-500/10"
            : "hover:bg-surface-overlay"
          }`}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
