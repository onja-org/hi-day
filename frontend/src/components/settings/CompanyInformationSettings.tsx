"use client";

import { useCurrentOrganisation } from "@/hooks/useCurrentOrganisation";
import { CompanyProfileFields } from "@/components/CompanyProfileFields";
import { ConfirmOrganisationDeletionPrompt } from "@/components/ConfirmOrganisationDeletionPrompt";
import { DeleteOrganisationSection } from "@/components/DeleteOrganisationSection";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SettingsSectionRow } from "@/components/SettingsSectionRow";

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
        buildInput={(formData) => ({
          name: String(formData.get("name") ?? ""),
          address: String(formData.get("address") ?? ""),
          // Sent even when empty: that's how a saved website is cleared.
          website: String(formData.get("website") ?? "").trim(),
        })}
      >
        {(loaded) => (
          <SettingsSectionRow
            title="Company profile"
            description="Shown on invoices, exports and invitations."
          >
            <CompanyProfileFields organisation={loaded} />
          </SettingsSectionRow>
        )}
      </SettingsPanel>

      {organisation && <DeleteOrganisationSection organisation={organisation} />}
    </>
  );
}
