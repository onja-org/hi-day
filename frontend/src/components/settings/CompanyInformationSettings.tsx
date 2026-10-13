"use client";

import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { CompanyProfileFields } from "@/components/CompanyProfileFields";
import { CompanyRegionalFields } from "@/components/CompanyRegionalFields";
import { ConfirmOrganisationDeletionPrompt } from "@/components/ConfirmOrganisationDeletionPrompt";
import { DeleteOrganisationSection } from "@/components/DeleteOrganisationSection";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SettingsSectionRow } from "@/components/SettingsSectionRow";
import type { Industry, WeekStart } from "@/types/organisation";

type CompanyInformationSettingsProps = {
  /** From the emailed deletion-confirmation link's query string. */
  confirmDeletionToken?: string;
};

export function CompanyInformationSettings({
  confirmDeletionToken,
}: CompanyInformationSettingsProps) {
  const organisation = useCurrentOrganisation().data;

  return (
    <>
      {organisation && confirmDeletionToken && (
        <ConfirmOrganisationDeletionPrompt
          organisation={organisation}
          token={confirmDeletionToken}
        />
      )}

      <SettingsPanel
        // Blank optional fields are sent as '', which is how the API is told
        // a value was cleared; `undefined` would leave the stored one.
        buildInput={(formData) => ({
          name: String(formData.get("name") ?? ""),
          industry: String(formData.get("industry") ?? "") as Industry | "",
          address: String(formData.get("address") ?? ""),
          taxId: String(formData.get("taxId") ?? ""),
          website: String(formData.get("website") ?? ""),
          timezone: String(formData.get("timezone") ?? ""),
          weekStartsOn: String(formData.get("weekStartsOn") ?? "") as WeekStart,
        })}
      >
        {(loaded) => (
          <>
            <SettingsSectionRow
              title="Company profile"
              description="Shown on invoices, exports and invitations."
            >
              <CompanyProfileFields organisation={loaded} />
            </SettingsSectionRow>

            <SettingsSectionRow
              title="Regional settings"
              description="How dates and weeks are read across the dashboard, timesheets and reports."
            >
              <CompanyRegionalFields organisation={loaded} />
            </SettingsSectionRow>
          </>
        )}
      </SettingsPanel>

      {organisation && <DeleteOrganisationSection organisation={organisation} />}
    </>
  );
}
