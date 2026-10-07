const INDUSTRIES = [
  { name: "Agencies", body: "Track billable hours per client and project, then export them for invoicing." },
  { name: "Remote & hybrid teams", body: "Stay in sync across time zones without endless check-in meetings." },
  { name: "Support teams", body: "Cover the queue and know exactly where every hour went." },
  { name: "Freelancers & VAs", body: "Show clients clear, honest timesheets and get paid for every hour." },
  { name: "Software teams", body: "Log time against tasks and sprints without leaving your workflow." },
  { name: "Nonprofits & NGOs", body: "Account for staff and volunteer time when funders ask where it went." },
];

export function LandingIndustries() {
  return (
    <section id="industries" className="border-b-3 border-ink">
      <div className="mx-auto flex max-w-300 flex-col gap-10 px-6 py-24">
        <h2 className="font-display text-heading font-extrabold tracking-heading">Made for how you work.</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((industry) => (
            <div
              key={industry.name}
              className="flex flex-col gap-2 rounded-brand border-3 border-ink bg-white p-6 shadow-hard"
            >
              <h3 className="text-2xl font-extrabold">{industry.name}</h3>
              <p className="text-ink-muted">{industry.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
