import type { Icon } from "@phosphor-icons/react";
import {
  Buildings,
  ChartBar,
  EnvelopeSimple,
  Timer,
} from "@phosphor-icons/react/dist/ssr";
import { ScrollReveal } from "../ScrollReveal";

type Step = {
  icon: Icon;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    icon: Buildings,
    title: "Create your organisation",
    description:
      "Sign up with your name, email, and your company's details to set up your organisation.",
  },
  {
    icon: EnvelopeSimple,
    title: "Invite your team",
    description:
      "Send email invitations with a role and team already assigned. They set a password and they're in.",
  },
  {
    icon: Timer,
    title: "Track time & activity",
    description:
      "Your team logs hours against their work, and activity flows into one shared dashboard.",
  },
  {
    icon: ChartBar,
    title: "Review as an organisation",
    description:
      "Admins and managers see timesheets, activity, and teams in one place — scoped to their role.",
  },
];

export function LandingHowItWorks() {
  return (
    <section className="bg-cream py-20 lg:py-28">
      <div className="container">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold text-primary-dark sm:text-4xl">
            From sign-up to visibility in four steps
          </h2>
        </ScrollReveal>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <ScrollReveal key={step.title}>
              <div className="flex h-full flex-col gap-4 rounded-xl bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-dark text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <step.icon
                    size={24}
                    className="text-primary"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-lg font-semibold text-primary-dark">
                  {step.title}
                </h3>
                <p className="text-slate-900">{step.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
