import { ServicesView } from "@/components/services-view";

type ServicesPageProps = { searchParams: Promise<{ search?: string }> };

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const params = await searchParams;
  return <ServicesView initialQuery={params.search ?? ""} />;
}
