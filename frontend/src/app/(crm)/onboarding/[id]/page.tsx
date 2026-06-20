import { OnboardingDetailView } from "@/components/detail-views";

export default async function OnboardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OnboardingDetailView id={decodeURIComponent(id)} />;
}
