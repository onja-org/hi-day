import type { Metadata } from "next";
import { SubscriptionSettings } from "@/components/settings/SubscriptionSettings";

export const metadata: Metadata = { title: "Subscription · Settings" };

type SubscriptionSettingsPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function SubscriptionSettingsPage({
  params,
}: SubscriptionSettingsPageProps) {
  const { organisationId } = await params;

  return <SubscriptionSettings organisationId={Number(organisationId)} />;
}
