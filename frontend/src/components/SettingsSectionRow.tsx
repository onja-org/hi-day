import type { ReactNode } from "react";

type SettingsSectionRowProps = {
  title: string;
  description: string;
  badge?: ReactNode;
  children: ReactNode;
};

/** One labeled row of the Settings page: description on the left, a field card on the right. */
export function SettingsSectionRow({
  title,
  description,
  badge,
  children,
}: SettingsSectionRowProps) {
  return (
    <div className="grid gap-4 first:pt-0 sm:grid-cols-3 sm:gap-8">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-medium text-primary-dark">{title}</h2>
        <p className="text-sm text-slate-900/60">{description}</p>
        {badge}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}
