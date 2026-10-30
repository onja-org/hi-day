import type { Metadata } from "next";
import { BillingInfoSettings } from "@/components/settings/BillingInfoSettings";

export const metadata: Metadata = { title: "Billing info · Settings" };

type BillingInfoPageProps = {
  params: Promise<{ organisationId: string }>;
};

export default async function BillingInfoPage({ params }: BillingInfoPageProps) {
  const { organisationId } = await params;

  return <BillingInfoSettings organisationId={Number(organisationId)} />;
}
