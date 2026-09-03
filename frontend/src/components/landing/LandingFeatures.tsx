import type { Icon } from "@phosphor-icons/react";
import {
  Buildings,
  ChartLineUp,
  Clock,
  EnvelopeSimple,
  ShieldCheck,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { ScrollReveal } from "../ScrollReveal";

type Feature = {
  icon: Icon;
  title: string;
  description: string;
};

const REVEAL_DELAY_CLASSES = [
  "",
  "delay-75",
  "delay-150",
  "delay-200",
  "delay-300",
  "delay-300",
];

const FEATURES: Feature[] = [
  {
    icon: Clock,
    title: "Timesheets",
    description:
      "Every member logs hours against the work they're doing, so timesheets stay accurate without end-of-week guesswork.",
  },
  {
    icon: ChartLineUp,
    title: "Activity insight",
    description:
      "See how work is flowing across your organisation over time, without micromanaging any one person's day.",
  },
  {
    icon: UsersThree,
    title: "Teams",
    description:
      "Group members into teams so time and reporting roll up the way your organisation is actually structured.",
  },
  {
    icon: ShieldCheck,
    title: "Roles & permissions",
    description:
      "Admin, manager, member, and finance roles keep access scoped to what each person actually needs to see.",
  },
  {
    icon: EnvelopeSimple,
    title: "Simple invitations",
    description:
      "Invite teammates by email with a role and team already assigned — they set a password and they're in.",
  },
  {
    icon: Buildings,
    title: "Multi-organisation",
    description:
      "One account can belong to more than one organisation, each with its own teams, members, and settings.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="bg-white py-20 lg:py-28">
      <div className="container">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold text-primary-dark sm:text-4xl">
            Everything your organisation needs to track work
          </h2>
          <p className="mt-4 text-lg text-slate-900">
            One platform for the people managing time and the people logging
            it.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <ScrollReveal key={feature.title} className={REVEAL_DELAY_CLASSES[index]}>
              <div className="group flex h-full flex-col gap-4 rounded-xl border border-primary-dark/10 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-cream text-primary-dark transition-colors duration-200 group-hover:bg-primary group-hover:text-white">
                  <feature.icon size={24} aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold text-primary-dark">
                  {feature.title}
                </h3>
                <p className="text-slate-900">{feature.description}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
