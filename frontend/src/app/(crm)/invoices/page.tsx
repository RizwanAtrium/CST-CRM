import { InvoicesView } from "@/components/invoices-view";

type InvoicesPageProps = { searchParams: Promise<{ paid?: string; status?: string }> };

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = await searchParams;
  const statuses = ["All", "Paid", "Sent", "Late", "Not Sent"];
  const initialStatus = statuses.includes(params.status ?? "") ? params.status : "All";
  const initialPaid = params.paid === "true" ? true : params.paid === "false" ? false : undefined;
  return <InvoicesView initialStatus={initialStatus} initialPaid={initialPaid} />;
}
