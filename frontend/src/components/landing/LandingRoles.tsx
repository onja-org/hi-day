import { ScrollReveal } from "../ScrollReveal";

type Role = {
  name: string;
  description: string;
};

const ROLES: Role[] = [
  {
    name: "Admin",
    description:
      "Full control over the organisation — settings, teams, and every membership.",
  },
  {
    name: "Manager",
    description: "Oversees a team's timesheets and activity day to day.",
  },
  {
    name: "Member",
    description: "Tracks and manages their own time and work.",
  },
  {
    name: "Finance",
    description: "Visibility into hours logged for billing and reporting.",
  },
];

export function LandingRoles() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <ScrollReveal>
            <h2 className="text-3xl font-semibold text-primary-dark sm:text-4xl">
              Access scoped to the role, not the whole organisation
            </h2>
            <p className="mt-4 max-w-xl text-lg text-slate-900">
              Every membership carries a role, so people see exactly what
              their job requires — nothing they don&apos;t need, nothing they
              shouldn&apos;t have.
            </p>
          </ScrollReveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {ROLES.map((role) => (
              <ScrollReveal key={role.name}>
                <div className="flex h-full flex-col gap-2 rounded-xl border border-primary-dark/10 p-5">
                  <h3 className="text-base font-semibold text-primary">
                    {role.name}
                  </h3>
                  <p className="text-sm text-slate-900">{role.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
