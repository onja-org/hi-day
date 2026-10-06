import type { Metadata } from "next";
import { DevicesPageContent } from "@/components/DevicesPageContent";

export const metadata: Metadata = {
  title: "Devices",
};

type DevicesPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function DevicesPage({ params }: DevicesPageProps) {
  const { organisationId } = await params;

  return <DevicesPageContent organisationId={organisationId} />;
}
