import type { InputHTMLAttributes } from "react";

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  wrapperClassName?: string;
};

export function Switch({ wrapperClassName = "", ...inputProps }: SwitchProps) {
  return (
    <label
      className={`relative inline-flex shrink-0 items-center ${
        inputProps.disabled ? "cursor-not-allowed" : ""
      } ${wrapperClassName}`}
    >
      <input type="checkbox" className="peer sr-only" {...inputProps} />
      <div className="peer bg-surface-interactive peer-checked:bg-accent after:bg-text-tertiary h-5 w-9 rounded-full transition-colors peer-focus:outline-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 after:absolute after:inset-s-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white rtl:peer-checked:after:-translate-x-full" />
    </label>
  );
}
