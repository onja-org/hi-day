import { DevicesPageContent } from "@/components/DevicesPageContent";

type DevicesPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function DevicesPage({ params }: DevicesPageProps) {
  const { organisationId } = await params;

  return <DevicesPageContent organisationId={organisationId} />;
}
