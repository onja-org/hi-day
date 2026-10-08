import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsCards } from "@/components/settings/SettingsCards";
import { settingsHref } from "@/lib/settingsNavigation";

export const metadata: Metadata = { title: "Settings" };

type SettingsPageProps = {
  params: Promise<{ organisationId: string }>;
  searchParams: Promise<{ confirmDeletion?: string }>;
};

export default async function SettingsPage({
  params,
  searchParams,
}: SettingsPageProps) {
  const { organisationId } = await params;
  const { confirmDeletion } = await searchParams;

  // The deletion-confirmation email links here, and the token is the whole
  // point of that link — it belongs with the section that acts on it.
  if (confirmDeletion) {
    redirect(
      `${settingsHref(organisationId, "organization", "company-information")}` +
        `?confirmDeletion=${encodeURIComponent(confirmDeletion)}`,
    );
  }

  return <SettingsCards organisationId={organisationId} />;
}
