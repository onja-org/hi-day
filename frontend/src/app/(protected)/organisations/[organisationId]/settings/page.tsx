import { OrganisationSettingsPageContent } from "@/components/OrganisationSettingsPageContent";

type SettingsPageProps = {
  searchParams: Promise<{ confirmDeletion?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { confirmDeletion } = await searchParams;

  return <OrganisationSettingsPageContent confirmDeletionToken={confirmDeletion} />;
}
