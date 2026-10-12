import type { Metadata } from "next";
import { CompanyInformationSettings } from "@/components/settings/CompanyInformationSettings";

export const metadata: Metadata = { title: "Company information · Settings" };

type PageProps = {
  searchParams: Promise<{ confirmDeletion?: string }>;
};

export default async function CompanyInformationPage({ searchParams }: PageProps) {
  const { confirmDeletion } = await searchParams;
  return <CompanyInformationSettings confirmDeletionToken={confirmDeletion} />;
}
