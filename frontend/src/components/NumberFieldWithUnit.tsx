import type { ChangeEvent } from "react";

type BaseProps = {
  name: string;
  label: string;
  unit: string;
  hint?: string;
  min?: number;
  max?: number;
};

type NumberFieldWithUnitProps =
  | (BaseProps & { defaultValue: number; value?: never; onChange?: never })
  | (BaseProps & {
      value: number;
      onChange: (value: number) => void;
      defaultValue?: never;
    });

export function NumberFieldWithUnit({
  name,
  label,
  unit,
  hint,
  min = 1,
  max,
  value,
  onChange,
  defaultValue,
}: NumberFieldWithUnitProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <span className="flex h-11 items-center overflow-hidden rounded-md border border-input-border bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
        <input
          name={name}
          type="number"
          min={min}
          max={max}
          step="1"
          {...(onChange
            ? {
                value,
                onChange: (event: ChangeEvent<HTMLInputElement>) =>
                  onChange(Number(event.target.value)),
              }
            : { defaultValue })}
          className="h-full w-full min-w-0 flex-1 px-3 text-slate-900 focus:outline-none"
        />
        <span className="flex h-full shrink-0 items-center border-l border-input-border bg-sidebar px-3 text-sm text-slate-900/60">
          {unit}
        </span>
      </span>
      {hint && <span className="text-xs text-slate-900/60">{hint}</span>}
    </label>
  );
}
