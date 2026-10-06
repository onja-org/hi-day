import type { Metadata } from "next";
import { MembersPageContent } from "@/components/MembersPageContent";

export const metadata: Metadata = {
  title: "Members",
};

type MembersPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function MembersPage({ params }: MembersPageProps) {
  const { organisationId } = await params;

  return <MembersPageContent organisationId={organisationId} />;
}
