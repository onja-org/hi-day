import clsx from "clsx";

type AvatarStackItem = {
  id: string;
  /** Full name, read out to screen readers and shown on hover. */
  label: string;
  initials: string;
};

type AvatarStackProps = {
  items: AvatarStackItem[];
  /** How many avatars to show before collapsing the rest into "+N". */
  max?: number;
  tone?: "primary" | "secondary";
  emptyLabel?: string;
};

/** Overlapping initials circles, e.g. a project's members or teams. */
export function AvatarStack({
  items,
  max = 3,
  tone = "primary",
  emptyLabel = "None",
}: AvatarStackProps) {
  if (items.length === 0) {
    return <span className="text-slate-900/60">{emptyLabel}</span>;
  }

  const visible = items.slice(0, max);
  const hidden = items.slice(max);

  return (
    <ul className="flex items-center" aria-label={items.map((item) => item.label).join(", ")}>
      {visible.map((item) => (
        <li
          key={item.id}
          title={item.label}
          aria-hidden="true"
          className={clsx(
            "-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white first:ml-0",
            tone === "primary" && "bg-primary",
            tone === "secondary" && "bg-secondary",
          )}
        >
          {item.initials}
        </li>
      ))}
      {hidden.length > 0 && (
        <li
          title={hidden.map((item) => item.label).join(", ")}
          aria-hidden="true"
          className="-ml-1 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary ring-2 ring-white"
        >
          +{hidden.length}
        </li>
      )}
    </ul>
  );
}
