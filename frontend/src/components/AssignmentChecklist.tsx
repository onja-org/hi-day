type AssignmentChecklistItem = {
  id: string;
  name: string;
  /** Set when the caller can't change this item — shown disabled, with this as its hover text. */
  disabledReason?: string;
};

type AssignmentChecklistProps = {
  title: string;
  items: AssignmentChecklistItem[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  emptyText: string;
};

export function AssignmentChecklist({
  title,
  items,
  selectedIds,
  onChange,
  emptyText,
}: AssignmentChecklistProps) {
  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold text-primary-dark">{title}</legend>
      {items.length === 0 ? (
        <p className="text-sm text-slate-900/70">{emptyText}</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border border-input-border p-2">
          {items.map((item) => (
            <li key={item.id}>
              <label
                title={item.disabledReason}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-900 hover:bg-cream has-disabled:cursor-not-allowed has-disabled:opacity-50"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggle(item.id)}
                  disabled={Boolean(item.disabledReason)}
                  className="accent-primary"
                />
                {item.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
