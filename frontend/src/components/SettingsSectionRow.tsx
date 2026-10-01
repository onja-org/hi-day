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
    <div className="grid gap-y-8 md:grid-cols-3 md:gap-x-8">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-medium text-primary-dark">{title}</h2>
        <p className="text-sm text-slate-900/60">{description}</p>
        {badge}
      </div>
      <div className="min-w-0 md:col-span-2">{children}</div>
    </div>
  );
}
