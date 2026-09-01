import type { CreateAccountInput } from "@/types/account";

export function parseSignUpFormData(formData: FormData): CreateAccountInput {
  const website = formData.get("website");

  return {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    address: String(formData.get("address") ?? ""),
    website: website ? String(website) : undefined,
  };
}
