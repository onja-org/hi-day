import { DisclosureDraftForm } from "./DisclosureDraftForm";
import { RequireRole } from "./RequireRole";

export function DisclosureSettingsPageContent() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-primary-dark">
        Consent &amp; disclosure
      </h1>

      <RequireRole role="admin">
        <DisclosureDraftForm />
      </RequireRole>
    </div>
  );
}
