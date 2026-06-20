import { OperationsView } from "@/components/operations-view";

type ComplaintsPageProps = { searchParams: Promise<{ status?: string; from?: string; to?: string }> };

export default async function ComplaintsPage({ searchParams }: ComplaintsPageProps) {
  const params = await searchParams;
  return <OperationsView type="complaints" initialStatus={params.status ?? "All"} initialFrom={params.from ?? ""} initialTo={params.to ?? ""} />;
}
