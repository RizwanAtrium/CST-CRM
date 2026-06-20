import { DashboardLoader } from "@/components/dashboard-loader";
import { activities, dashboard } from "@/lib/demo-data";

type DashboardPageProps = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const today = new Date();
  const defaultFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return <DashboardLoader initialData={dashboard} initialActivity={activities} initialFrom={params.from ?? defaultFrom} initialTo={params.to ?? defaultTo} />;
}
