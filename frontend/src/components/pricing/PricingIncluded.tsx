import { CheckIcon } from "@phosphor-icons/react/dist/ssr";

const GROUPS = [
  {
    title: "Time tracking",
    points: [
      "Web and desktop timer that stay in sync",
      "Daily, weekly and calendar timesheets",
      "Manual edits, with every change logged",
      "Work limits and reminders",
    ],
  },
  {
    title: "Desktop app",
    points: [
      "Windows, macOS and Linux",
      "Works offline and syncs later",
      "Idle detection",
      "Compact always-on-top bar and auto-updates",
    ],
  },
  {
    title: "Activity",
    points: [
      "Apps and websites, no browser extension needed",
      "Optional screenshots at your chosen interval",
      "Activity level for every 10 minutes",
      "You choose what's captured and how long it's kept",
    ],
  },
  {
    title: "Reports",
    points: [
      "Dashboards, including who's online now",
      "Time, activity and apps reports",
      "CSV and PDF export",
      "Scheduled email reports",
    ],
  },
  {
    title: "Projects & tasks",
    points: [
      "Projects with their own roles",
      "Kanban task board",
      "Estimates and due dates",
      "Import from CSV or Excel",
    ],
  },
  {
    title: "Team & admin",
    points: [
      "Admin, Manager and Member roles",
      "Teams, with people in more than one",
      "Invite by email, link or spreadsheet",
      "See and sign out devices remotely",
    ],
  },
];

export function PricingIncluded() {
  return (
    <section className="border-b-3 border-ink bg-white">
      <div className="mx-auto flex max-w-300 flex-col gap-10 px-6 py-24">
        <div className="flex max-w-180 flex-col gap-3">
          <span className="text-xs font-extrabold tracking-widest text-volt uppercase">What you get</span>
          <h2 className="font-display text-heading font-extrabold tracking-heading">
            Everything included, on every plan.
          </h2>
          <p className="text-lg text-ink-muted">
            No add-ons and nothing locked behind a higher tier. Every team gets all of this.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((group) => (
            <div
              key={group.title}
              className="flex flex-col gap-4 rounded-brand border-3 border-ink bg-chalk p-7 shadow-hard-sm"
            >
              <h3 className="font-display text-2xl font-extrabold tracking-heading">{group.title}</h3>
              <ul className="flex flex-col gap-2.5">
                {group.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <CheckIcon size={20} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
