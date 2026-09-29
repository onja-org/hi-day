type ActivityHourSectionRowProps = {
  label: string;
  colSpan: number;
};

export function ActivityHourSectionRow({
  label,
  colSpan,
}: ActivityHourSectionRowProps) {
  return (
    <tr className="border-t border-b border-input-border">
      <th
        colSpan={colSpan}
        scope="colgroup"
        className="px-3 py-3 text-left text-sm font-semibold tracking-wide text-primary-dark uppercase"
      >
        {label}
      </th>
    </tr>
  );
}
