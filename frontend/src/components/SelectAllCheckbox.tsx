"use client";

type SelectAllCheckboxProps = {
  label: string;
  selectedCount: number;
  totalCount: number;
  onChange: (selectAll: boolean) => void;
};

/** A header checkbox that's ticked when every row is, and shows the
 * indeterminate dash when only some are. */
export function SelectAllCheckbox({
  label,
  selectedCount,
  totalCount,
  onChange,
}: SelectAllCheckboxProps) {
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={allSelected}
      ref={(input) => {
        if (input) input.indeterminate = selectedCount > 0 && !allSelected;
      }}
      onChange={() => onChange(!allSelected)}
      disabled={totalCount === 0}
      className="cursor-pointer accent-primary"
    />
  );
}
