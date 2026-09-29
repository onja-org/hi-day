import clsx from "clsx";

type SegmentedControlProps<K extends string> = {
  label: string;
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
};

/** A pill-shaped switch between a few views, e.g. List / Kanban. */
export function SegmentedControl<K extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<K>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-primary-dark/5 p-1">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          className={clsx(
            "cursor-pointer rounded-full px-5 py-1.5 text-sm font-medium transition-colors duration-150",
            value === option.key && "bg-white text-primary-dark shadow-sm",
            value !== option.key && "text-slate-900/70 hover:text-primary-dark",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
