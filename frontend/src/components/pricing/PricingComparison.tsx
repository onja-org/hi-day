import { CheckIcon } from "@phosphor-icons/react/dist/ssr";

/** `null` renders the tick; a string renders as plain text in that cell. */
const ROWS: { feature: string; selfHosted: string | null; cloud: string | null }[] = [
  { feature: "Every Hi Day feature", selfHosted: null, cloud: null },
  { feature: "Hosting, updates & security fixes", selfHosted: "You", cloud: null },
  { feature: "Backups", selfHosted: "You", cloud: null },
  { feature: "Support", selfHosted: "Community on GitHub", cloud: null },
];

function Cell({ value }: { value: string | null }) {
  if (value) {
    return <span className="text-ink-muted">{value}</span>;
  }
  return (
    <>
      <CheckIcon size={22} weight="bold" aria-hidden="true" className="inline text-success" />
      <span className="sr-only">Included</span>
    </>
  );
}

export function PricingComparison() {
  return (
    <section className="border-b-3 border-ink bg-white">
      <div className="mx-auto flex max-w-300 flex-col gap-8 px-6 py-24">
        <div className="flex max-w-180 flex-col gap-3">
          <span className="text-xs font-extrabold tracking-widest text-volt uppercase">Self-hosted or Cloud</span>
          <h2 className="font-display text-heading font-extrabold tracking-heading">
            Same software. Cloud means we run it for you.
          </h2>
        </div>
        <div className="relative w-full max-w-245 overflow-x-auto rounded-brand border-3 border-ink bg-white">
          <table className="w-full min-w-130 border-collapse">
            <thead>
              <tr className="border-b-3 border-ink">
                <th scope="col" className="px-5 py-3.5 text-left" />
                <th scope="col" className="px-5 py-3.5 font-display text-xl font-extrabold">
                  Self-hosted
                </th>
                <th scope="col" className="px-5 py-3.5 font-display text-xl font-extrabold">
                  Cloud
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, index) => (
                <tr key={row.feature} className={index < ROWS.length - 1 ? "border-b border-input-border" : undefined}>
                  <th scope="row" className="px-5 py-3.5 text-left font-normal">
                    {row.feature}
                  </th>
                  <td className="px-5 py-3.5 text-center">
                    <Cell value={row.selfHosted} />
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Cell value={row.cloud} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
