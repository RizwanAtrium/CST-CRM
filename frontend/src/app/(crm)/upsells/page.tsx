import { OperationsView } from "@/components/operations-view";

type UpsellsPageProps = { searchParams: Promise<{ status?: string; from?: string; to?: string }> };

export default async function UpsellsPage({ searchParams }: UpsellsPageProps) {
  const params = await searchParams;
  return <OperationsView type="upsells" initialStatus={params.status ?? "All"} initialFrom={params.from ?? ""} initialTo={params.to ?? ""} />;
}
