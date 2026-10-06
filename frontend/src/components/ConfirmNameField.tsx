import { CheckIcon } from "@phosphor-icons/react";

type ConfirmNameFieldProps = {
  expectedName: string;
  value: string;
  onChange: (value: string) => void;
};

/** "Type the organisation name to confirm", ticked once it matches exactly. */
export function ConfirmNameField({
  expectedName,
  value,
  onChange,
}: ConfirmNameFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-900">
        Type{" "}
        <code className="rounded-md bg-cream px-1.5 py-0.5">{expectedName}</code>{" "}
        to confirm
      </span>
      <span className="relative">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          className="w-full rounded-md border border-input-border bg-white px-3 pr-9 h-11 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {value === expectedName && (
          <CheckIcon
            size={18}
            aria-hidden="true"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-success"
          />
        )}
      </span>
    </label>
  );
}
