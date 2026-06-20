import { ClientDetailView } from "@/components/detail-views";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientDetailView id={decodeURIComponent(id)} />;
}
