import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillingInfoSettings } from "@/components/settings/BillingInfoSettings";
import { getPublicConfigServer } from "@/lib/getPublicConfigServer";

export const metadata: Metadata = { title: "Billing info · Settings" };

type BillingInfoPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function BillingInfoPage({ params }: BillingInfoPageProps) {
  // See the Subscription page: the nav omits the link, this refuses the route.
  const { billingEnabled } = await getPublicConfigServer();
  if (!billingEnabled) notFound();

  const { organisationId } = await params;

  return <BillingInfoSettings organisationId={Number(organisationId)} />;
}
