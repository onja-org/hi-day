import clsx from "clsx";

type PageTab<K extends string> = {
  key: K;
  label: string;
  count?: number;
};

type PageTabsProps<K extends string> = {
  tabs: PageTab<K>[];
  active: K;
  onChange: (key: K) => void;
};

/** Uppercase "LABEL (count)" tabs over a page's content, e.g. Active /
 * Archived projects or Members / Invites. */
export function PageTabs<K extends string>({ tabs, active, onChange }: PageTabsProps<K>) {
  return (
    <div className="flex gap-1 border-b border-input-border">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-pressed={isActive}
            className={clsx(
              "-mb-px cursor-pointer border-b-2 px-4 py-2 text-sm font-medium tracking-wide uppercase transition-colors duration-150",
              isActive && "border-primary text-primary",
              !isActive && "border-transparent text-slate-900 hover:text-primary-dark",
            )}
          >
            {tab.label}
            {tab.count !== undefined && ` (${tab.count})`}
          </button>
        );
      })}
    </div>
  );
}
