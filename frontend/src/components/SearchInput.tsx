import { MagnifyingGlass } from "@phosphor-icons/react";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Doubles as the input's accessible label. */
  placeholder: string;
};

/** The rounded search box at the top of a list page. */
export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  return (
    <label className="relative flex w-full items-center sm:max-w-sm">
      <span className="sr-only">{placeholder}</span>
      <MagnifyingGlass
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-4 text-icon"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-input-border py-2 pr-4 pl-10 text-sm text-slate-900"
      />
    </label>
  );
}
