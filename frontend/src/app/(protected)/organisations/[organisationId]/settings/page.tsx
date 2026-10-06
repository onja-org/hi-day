import type { Metadata } from "next";
import { OrganisationSettingsPageContent } from "@/components/OrganisationSettingsPageContent";

export const metadata: Metadata = {
  title: "Settings",
};

type SettingsPageProps = {
  searchParams: Promise<{ confirmDeletion?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { confirmDeletion } = await searchParams;

  return <OrganisationSettingsPageContent confirmDeletionToken={confirmDeletion} />;
}
