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
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-900">
            Company name
          </span>
          <input
            name="name"
            type="text"
            defaultValue={organisation.name}
            required
            className="rounded-md border border-input-border bg-white px-3 h-11 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-900">Address</span>
          <input
            name="address"
            type="text"
            defaultValue={organisation.address ?? ""}
            required
            className="rounded-md border border-input-border bg-white px-3 h-11 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-900">
          Website · optional
        </span>
        <input
          name="website"
          type="text"
          defaultValue={organisation.website ?? ""}
          placeholder="https://example.com"
          className="rounded-md border border-input-border bg-white px-3 h-11 text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>
    </div>
  );
}
