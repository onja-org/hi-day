import { MemberDetailPageContent } from "@/components/MemberDetailPageContent";

type MemberDetailPageProps = {
  params: Promise<{ organisationId: string; memberId: string }>;
};

export default async function MemberDetailPage({
  params,
}: MemberDetailPageProps) {
  const { organisationId, memberId } = await params;

  return (
    <MemberDetailPageContent
      organisationId={organisationId}
      memberId={memberId}
    />
  );
}
