/** The states are told apart by fill before anything is read, so the fills
 * are named once here rather than in a tooltip per cell. */
export function ScreenshotSlotsLegend() {
  const items = [
    { label: "Screenshot captured", swatch: "bg-primary-dark" },
    { label: "No screenshot", swatch: "bg-cream" },
    { label: "No activity", swatch: "bg-primary-dark/5" },
  ];

  return (
    <ul className="flex flex-wrap items-center gap-5">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-2 text-xs text-slate-900/70"
        >
          <span
            aria-hidden
            className={`h-3.5 w-3.5 rounded-brand-sm border border-input-border ${item.swatch}`}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
