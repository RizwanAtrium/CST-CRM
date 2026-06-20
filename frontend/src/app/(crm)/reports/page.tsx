import { OperationsView } from "@/components/operations-view";

type ReportsPageProps = { searchParams: Promise<{ status?: string; from?: string; to?: string }> };

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  return <OperationsView type="reports" initialStatus={params.status ?? "All"} initialFrom={params.from ?? ""} initialTo={params.to ?? ""} />;
}
