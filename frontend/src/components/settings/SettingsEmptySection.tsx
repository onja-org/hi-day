type SettingsEmptySectionProps = {
  title: string;
  description: string;
};

/** A section the shell lists but whose settings are a later ticket. */
export function SettingsEmptySection({
  title,
  description,
}: SettingsEmptySectionProps) {
  return (
    <section className="rounded-lg border border-input-border bg-white p-6">
      <h2 className="text-base font-medium text-primary-dark">{title}</h2>
      <p className="mt-1 text-sm text-slate-900/60">{description}</p>
    </section>
  );
}
