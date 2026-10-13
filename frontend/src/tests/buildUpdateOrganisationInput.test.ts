import { describe, expect, it } from "vitest";
import { buildUpdateOrganisationInput } from "@/lib/buildUpdateOrganisationInput";

function formDataFrom(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("buildUpdateOrganisationInput", () => {
  it("parses numeric fields and converts screenshot frequency to seconds", () => {
    const input = buildUpdateOrganisationInput(
      formDataFrom({
        name: "Onja",
        address: "Toamasina",
        website: "https://onja.mg",
        idleHandling: "flag",
        idleThresholdMinutes: "5",
        workingHoursPerDay: "8",
        screenshotFrequencyMinutes: "5",
        screenshotRetentionDays: "30",
      }),
      { windowTrackingEnabled: true, screenshotsEnabled: true },
    );

    expect(input).toEqual({
      name: "Onja",
      address: "Toamasina",
      website: "https://onja.mg",
      idleHandling: "flag",
      idleThresholdMinutes: 5,
      workingHoursPerDay: 8,
      windowTrackingEnabled: true,
      screenshotsEnabled: true,
      screenshotFrequencySeconds: 300,
      screenshotRetentionDays: 30,
    });
  });

  it("sends an empty website to clear it and leaves non-numeric fields undefined", () => {
    const input = buildUpdateOrganisationInput(
      formDataFrom({
        name: "Onja",
        address: "Toamasina",
        website: "",
        idleHandling: "off",
        idleThresholdMinutes: "not-a-number",
        workingHoursPerDay: "not-a-number",
        screenshotFrequencyMinutes: "not-a-number",
        screenshotRetentionDays: "not-a-number",
      }),
      { windowTrackingEnabled: false, screenshotsEnabled: false },
    );

    expect(input.website).toBe("");
    expect(input.idleThresholdMinutes).toBeUndefined();
    expect(input.workingHoursPerDay).toBeUndefined();
    expect(input.screenshotFrequencySeconds).toBeUndefined();
    expect(input.screenshotRetentionDays).toBeUndefined();
    expect(input.windowTrackingEnabled).toBe(false);
    expect(input.screenshotsEnabled).toBe(false);
  });
});
