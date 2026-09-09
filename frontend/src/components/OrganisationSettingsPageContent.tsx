import { OrganisationSettingsForm } from "./OrganisationSettingsForm";
import { RequireRole } from "./RequireRole";

export function OrganisationSettingsPageContent() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-primary-dark">Settings</h1>

      <RequireRole role="admin">
        <OrganisationSettingsForm />
      </RequireRole>
    </div>
  );
}
