import type { InputHTMLAttributes } from "react";

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  wrapperClassName?: string;
};

export function Switch({ wrapperClassName = "", ...inputProps }: SwitchProps) {
  return (
    <label
      className={`relative inline-flex shrink-0 items-center ${
        inputProps.disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${wrapperClassName}`}
    >
      <input type="checkbox" className="peer sr-only" {...inputProps} />
      <div className="peer h-5 w-9 rounded-full bg-zinc-700 transition-colors peer-checked:bg-purple-600 peer-focus:outline-none after:absolute after:start-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-zinc-400 after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white rtl:peer-checked:after:-translate-x-full peer-disabled:cursor-not-allowed peer-disabled:opacity-70" />
    </label>
  );
}
