import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";
import { getPublicConfigServer } from "@/lib/getPublicConfigServer";

export const metadata: Metadata = { title: "Subscription · Settings" };

type SubscriptionSettingsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function SubscriptionSettingsPage({
  params,
}: SubscriptionSettingsPageProps) {
  // A self-hosted install has no subscription to show. The nav already omits
  // the link; this is what stops a bookmark or a typed URL getting through.
  const { billingEnabled } = await getPublicConfigServer();
  if (!billingEnabled) notFound();

  const { organisationId } = await params;

  return <SubscriptionSettings organisationId={Number(organisationId)} />;
}
