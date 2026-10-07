import type { Icon } from "@phosphor-icons/react";
import { ClipboardTextIcon, DesktopIcon, HourglassIcon, UserPlusIcon } from "@phosphor-icons/react/dist/ssr";

type Tool = { icon: Icon; title: string; body: string };

const TOOLS: Tool[] = [
  {
    icon: ClipboardTextIcon,
    title: "Timesheets & edits",
    body: "Timesheets fill themselves as you track. Add or fix an entry by hand when the day didn't go to plan.",
  },
  {
    icon: HourglassIcon,
    title: "Idle detection",
    body: "Step away and the time is flagged, so nobody is paid for, or blamed for, a forgotten timer.",
  },
  {
    icon: UserPlusIcon,
    title: "Easy onboarding",
    body: "Invite people by email, share a join link, or import a whole team from a spreadsheet.",
  },
  {
    icon: DesktopIcon,
    title: "On every desktop",
    body: "A light app for Windows, macOS and Linux that stays out of the way until you need it.",
  },
];

export function LandingTools() {
  return (
    <section className="border-b-3 border-ink">
      <div className="mx-auto flex max-w-300 flex-col gap-10 px-6 py-24">
        <h2 className="max-w-190 font-display text-heading font-extrabold tracking-heading">
          From first tick to timesheet.
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool) => (
            <div key={tool.title} className="flex flex-col gap-2.5 rounded-brand border-3 border-ink bg-white p-6">
              <tool.icon size={32} aria-hidden="true" />
              <h3 className="text-xl font-extrabold">{tool.title}</h3>
              <p className="text-ink-muted">{tool.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
