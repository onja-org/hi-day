import { describe, expect, it } from "vitest";
import { parseSignUpFormData } from "./parseSignUpFormData";

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("parseSignUpFormData", () => {
  it("maps the form fields as-is", () => {
    const result = parseSignUpFormData(
      formData({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@acme.test",
        companyName: "Acme Inc",
        address: "1 Main St, Springfield",
        website: "https://acme.test",
      }),
    );

    expect(result).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@acme.test",
      companyName: "Acme Inc",
      address: "1 Main St, Springfield",
      website: "https://acme.test",
    });
  });

  it("omits website when blank", () => {
    const result = parseSignUpFormData(
      formData({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@acme.test",
        companyName: "Acme Inc",
        address: "1 Main St, Springfield",
      }),
    );

    expect(result.website).toBeUndefined();
  });

  it("defaults missing fields to empty strings", () => {
    const result = parseSignUpFormData(formData({}));

    expect(result).toEqual({
      firstName: "",
      lastName: "",
      email: "",
      companyName: "",
      address: "",
      website: undefined,
    });
  });
});
