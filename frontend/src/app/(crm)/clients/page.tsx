import { ClientsView } from "@/components/clients-view";

type ClientsPageProps = { searchParams: Promise<{ search?: string; stage?: string }> };

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const stages = ["All", "Active", "In Progress", "Not Active"] as const;
  const initialStage = stages.find((stage) => stage === params.stage) ?? "All";
  return <ClientsView initialQuery={params.search ?? ""} initialStage={initialStage} />;
}
