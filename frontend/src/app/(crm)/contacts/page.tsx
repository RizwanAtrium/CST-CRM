import { OperationsView } from "@/components/operations-view";

type ContactsPageProps = { searchParams: Promise<{ status?: string; from?: string; to?: string }> };

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const params = await searchParams;
  return <OperationsView type="contacts" initialStatus={params.status ?? "All"} initialFrom={params.from ?? ""} initialTo={params.to ?? ""} />;
}
