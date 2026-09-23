import { OrganisationSettingsForm } from "./OrganisationSettingsForm";
import { RequireRole } from "./RequireRole";

export function OrganisationSettingsPageContent() {
  return (
    <RequireRole role="admin">
      <OrganisationSettingsForm />
    </RequireRole>
  );
}
