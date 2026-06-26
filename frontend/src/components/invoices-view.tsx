"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Ellipsis, Filter } from "lucide-react";
import { crmApi } from "@/lib/api";
import type { Invoice, Status } from "@/lib/types";
import { Badge, Button, Field, PageHeader, SearchField } from "./ui";

const tone = (status: Status) => status === "Paid" ? "success" : status === "Late" || status === "Not Sent" ? "danger" : "info";

export function InvoicesView({ initialStatus = "All", initialPaid }: { initialStatus?: string; initialPaid?: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [paidFilter, setPaidFilter] = useState<"All" | "Paid" | "Unpaid">(initialPaid === undefined ? "All" : initialPaid ? "Paid" : "Unpaid");

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    crmApi.invoices()
      .then(setInvoices)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void Promise.resolve().then(fetchInvoices); }, [fetchInvoices]);

  function togglePaid(invoice: Invoice) {
    crmApi.updateInvoice(invoice.id, { paid: !invoice.paid, paidDate: !invoice.paid ? new Date().toISOString() : null })
      .then(() => fetchInvoices())
      .catch(() => undefined);
  }

  const monthLabel = month ? new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
  const filtered = useMemo(() => invoices.filter((invoice) => (status === "All" || invoice.status === status) && (paidFilter === "All" || invoice.paid === (paidFilter === "Paid")) && (!monthLabel || invoice.month === monthLabel) && `${invoice.client} ${invoice.id}`.toLowerCase().includes(query.toLowerCase())), [invoices, monthLabel, paidFilter, query, status]);

  function clearFilters() {
    setQuery("");
    setStatus("All");
    setMonth("");
    setPaidFilter("All");
  }

  function exportLedger() {
    const csv = [["Invoice", "Client", "Month", "Amount", "Due", "Sent", "Status"], ...filtered.map((invoice) => [invoice.id, invoice.client, invoice.month, String(invoice.amount), invoice.due, invoice.sent || "", invoice.status])]
      .map((row) => row.map((value) => `"${value.replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-ledger-${month || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const invoicedThisMonth = useMemo(() => {
    const currentMonth = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return invoices.filter((i) => i.month === currentMonth).reduce((s, i) => s + i.amount, 0);
  }, [invoices]);

  const outstanding = useMemo(() => invoices.filter((i) => !i.paid).reduce((s, i) => s + i.amount, 0), [invoices]);

  if (loading) {
    return <div className="state-card" data-testid="loading-state"><strong>Loading invoices</strong><p>Fetching from CRM...</p></div>;
  }

  return <>
    <PageHeader eyebrow="Permanent financial ledger" title="Invoices" description="Monthly snapshots stay immutable when client services change." secondary={<Button variant="secondary" onClick={exportLedger}><Download size={15} />Export ledger</Button>} />
    <section className="mini-stats"><div className="mini-stat"><span>Invoiced this month</span><strong>${invoicedThisMonth.toLocaleString()}</strong></div><div className="mini-stat"><span>Outstanding</span><strong style={{ color: "var(--red)" }}>${outstanding.toLocaleString()}</strong></div><div className="mini-stat"><span>Total invoices</span><strong>{invoices.length}</strong></div><div className="mini-stat"><span>Paid</span><strong>{invoices.filter((i) => i.paid).length}</strong></div></section>
    <section className="panel" data-testid="invoice-ledger">
      <div className="toolbar"><div className="toolbar-group"><SearchField value={query} onChange={setQuery} placeholder="Search invoice or client..." /><Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}><Filter size={15} />Filters</Button></div><div className="filter-tabs">{["All", "Paid", "Sent", "Late", "Not Sent"].map((value) => <button className={status === value ? "active" : ""} key={value} onClick={() => setStatus(value)}>{value}</button>)}</div></div>
      {filtersOpen && <div className="operation-filters"><Field label="Status"><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Paid</option><option>Sent</option><option>Late</option><option>Not Sent</option></select></Field><Field label="Payment"><select value={paidFilter} onChange={(event) => setPaidFilter(event.target.value as "All" | "Paid" | "Unpaid")}><option>All</option><option>Paid</option><option>Unpaid</option></select></Field><Field label="Billing month"><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></Field><Button variant="ghost" onClick={clearFilters}>Clear filters</Button></div>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Client</th><th>Billing month</th><th>Amount</th><th>Due</th><th>Sent</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((invoice) => <tr key={invoice.id}><td><Link className="record-link" href={`/invoices/${invoice.id}`}>{invoice.id}</Link></td><td><Link className="row-link" href={`/invoices/${invoice.id}`}><strong>{invoice.client}</strong></Link></td><td>{invoice.month}</td><td><strong>${invoice.amount.toLocaleString()}</strong></td><td>{invoice.due}</td><td>{invoice.sent || "-"}</td><td><button style={{ border: 0, background: "transparent", padding: 0 }} onClick={() => togglePaid(invoice)} title="Toggle paid"><Badge tone={tone(invoice.status)}>{invoice.status}</Badge></button></td><td><Link className="table-action table-action-link" href={`/invoices/${invoice.id}`} aria-label={`Open ${invoice.id}`}><Ellipsis size={16} /></Link></td></tr>)}</tbody></table></div>
    </section>
  </>;
}
