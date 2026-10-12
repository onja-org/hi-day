import { SelectField, TextField } from "@/components/ui/form";
import { INDUSTRY_OPTIONS } from "@/lib/industryOptions";
import type { OrganisationProfile } from "@/types/organisation";

type CompanyProfileFieldsProps = {
  organisation: OrganisationProfile;
};

/** Split out of OrganisationSettingsFields (past the ~150-line guideline); submission still goes through the parent form's `FormData`. */
export function CompanyProfileFields({
  organisation,
}: CompanyProfileFieldsProps) {
  return (
    <div className="@container flex flex-col gap-4 rounded-lg border border-input-border bg-white p-5">
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          label="Company name"
          name="name"
          type="text"
          defaultValue={organisation.name}
          required
        />

        <SelectField
          label="Industry · optional"
          name="industry"
          defaultValue={organisation.industry ?? ""}
        >
          <option value="">Not set</option>
          {INDUSTRY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>

      <TextField
        label="Address · optional"
        name="address"
        type="text"
        defaultValue={organisation.address ?? ""}
      />

      <div className="grid gap-4 @md:grid-cols-2">
        <TextField
          label="Tax ID · optional"
          name="taxId"
          type="text"
          defaultValue={organisation.taxId ?? ""}
          maxLength={64}
          hint="VAT, EIN, TIN — whatever your jurisdiction issues."
        />

        <TextField
          label="Website · optional"
          name="website"
          type="text"
          defaultValue={organisation.website ?? ""}
          placeholder="https://example.com"
        />
      </div>
    </div>
  );
}
