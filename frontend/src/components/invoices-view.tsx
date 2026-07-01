"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Ellipsis, Filter } from "lucide-react";
import { crmApi, onCrmDataChanged } from "@/lib/api";
import type { Client, Invoice, Status } from "@/lib/types";
import { Badge, Button, Field, Modal, PageHeader, SearchField } from "./ui";

const tone = (status: Status) => status === "Paid" ? "success" : status === "Late" || status === "Not Sent" ? "danger" : "info";

export function InvoicesView({ initialStatus = "All", initialPaid }: { initialStatus?: string; initialPaid?: boolean }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [paidFilter, setPaidFilter] = useState<"All" | "Paid" | "Unpaid">(initialPaid === undefined ? "All" : initialPaid ? "Paid" : "Unpaid");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");

  const fetchInvoices = useCallback(() => {
    setLoading(true);
    Promise.all([crmApi.invoices(), crmApi.clients()])
      .then(([invoiceRows, clientRows]) => {
        setInvoices(invoiceRows);
        setClients(clientRows);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void Promise.resolve().then(fetchInvoices); }, [fetchInvoices]);
  useEffect(() => onCrmDataChanged(fetchInvoices), [fetchInvoices]);

  function togglePaid(invoice: Invoice) {
    crmApi.updateInvoice(invoice.id, { paid: !invoice.paid, paidDate: !invoice.paid ? new Date().toISOString() : null })
      .then(() => fetchInvoices())
      .catch((error) => setInvoiceError(error instanceof Error ? error.message : "Unable to update invoice."));
  }

  function saveInvoiceUpdate(formData: FormData) {
    if (!selectedInvoice) return;
    setInvoiceError("");
    const paid = String(formData.get("paid") || "false") === "true";
    const sentDate = String(formData.get("sentDate") || "");
    const paidDate = String(formData.get("paidDate") || "");
    crmApi.updateInvoice(selectedInvoice.id, {
      sentDate: sentDate || null,
      paid,
      paidDate: paid ? (paidDate || new Date().toISOString().slice(0, 10)) : null,
    }).then(() => {
      clearFilters();
      return fetchInvoices();
    }).then(() => setSelectedInvoice(null)).catch((error) => setInvoiceError(error instanceof Error ? error.message : "Unable to update invoice."));
  }

  function saveNewInvoice(formData: FormData) {
    setInvoiceError("");
    const clientId = String(formData.get("client") || "");
    const billingMonth = String(formData.get("billingMonth") || new Date().toISOString().slice(0, 7));
    const amount = Number(formData.get("amount") || 0);
    const dueDate = String(formData.get("dueDate") || "");
    const issueDate = String(formData.get("issueDate") || new Date().toISOString().slice(0, 10));
    const sentDate = String(formData.get("sentDate") || "");
    const paid = String(formData.get("paid") || "false") === "true";
    const paidDate = String(formData.get("paidDate") || "");
    if (!clientId || !billingMonth || !dueDate || amount <= 0) {
      setInvoiceError("Select client, billing month, due date, and amount.");
      return;
    }
    crmApi.createInvoice({
      client: clientId,
      billingMonth,
      amount,
      issueDate,
      dueDate,
      sentDate: sentDate || (paid ? (paidDate || issueDate) : null),
      paid,
      paidDate: paid ? (paidDate || issueDate) : null,
    }).then(() => {
      clearFilters();
      return fetchInvoices();
    }).then(() => setAddOpen(false)).catch((error) => setInvoiceError(error instanceof Error ? error.message : "Unable to add invoice."));
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
    <PageHeader eyebrow="Permanent financial ledger" title="Invoices" description="Monthly snapshots stay immutable when client services change." action={<Button onClick={() => { setInvoiceError(""); setAddOpen(true); }}>Add invoice</Button>} secondary={<Button variant="secondary" onClick={exportLedger}><Download size={15} />Export ledger</Button>} />
    <section className="mini-stats"><div className="mini-stat"><span>Invoiced this month</span><strong>${invoicedThisMonth.toLocaleString()}</strong></div><div className="mini-stat"><span>Outstanding</span><strong style={{ color: "var(--red)" }}>${outstanding.toLocaleString()}</strong></div><div className="mini-stat"><span>Total invoices</span><strong>{invoices.length}</strong></div><div className="mini-stat"><span>Paid</span><strong>{invoices.filter((i) => i.paid).length}</strong></div></section>
    <section className="panel" data-testid="invoice-ledger">
      <div className="toolbar"><div className="toolbar-group"><SearchField value={query} onChange={setQuery} placeholder="Search invoice or client..." /><Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}><Filter size={15} />Filters</Button></div><div className="filter-tabs">{["All", "Paid", "Sent", "Late", "Not Sent"].map((value) => <button className={status === value ? "active" : ""} key={value} onClick={() => setStatus(value)}>{value}</button>)}</div></div>
      {filtersOpen && <div className="operation-filters"><Field label="Status"><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Paid</option><option>Sent</option><option>Late</option><option>Not Sent</option></select></Field><Field label="Payment"><select value={paidFilter} onChange={(event) => setPaidFilter(event.target.value as "All" | "Paid" | "Unpaid")}><option>All</option><option>Paid</option><option>Unpaid</option></select></Field><Field label="Billing month"><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></Field><Button variant="ghost" onClick={clearFilters}>Clear filters</Button></div>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Client</th><th>Billing month</th><th>Amount</th><th>Due</th><th>Sent</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((invoice) => <tr key={invoice.id}><td><Link className="record-link" href={`/invoices/${invoice.id}`}>{invoice.id}</Link></td><td><Link className="row-link" href={`/invoices/${invoice.id}`}><strong>{invoice.client}</strong></Link></td><td>{invoice.month}</td><td><strong>${invoice.amount.toLocaleString()}</strong></td><td>{invoice.due}</td><td>{invoice.sent || "-"}</td><td><button style={{ border: 0, background: "transparent", padding: 0 }} onClick={() => togglePaid(invoice)} title="Toggle paid"><Badge tone={tone(invoice.status)}>{invoice.status}</Badge></button></td><td><div className="header-actions"><Button variant="ghost" onClick={() => setSelectedInvoice(invoice)}>Edit</Button><Link className="table-action table-action-link" href={`/invoices/${invoice.id}`} aria-label={`Open ${invoice.id}`}><Ellipsis size={16} /></Link></div></td></tr>)}</tbody></table></div>
    </section>
    <Modal open={Boolean(selectedInvoice)} onClose={() => setSelectedInvoice(null)} title="Update invoice" description="Update sent and paid fields. Status recalculates after save." footer={<><Button variant="secondary" onClick={() => setSelectedInvoice(null)}>Cancel</Button><Button type="submit" form="invoice-ledger-update-form">Save update</Button></>}>
      {selectedInvoice && <form id="invoice-ledger-update-form" className="form-grid" action={saveInvoiceUpdate}>
        {invoiceError && <div className="field full"><div className="login-error">{invoiceError}</div></div>}
        <Field label="Invoice"><input value={selectedInvoice.id} readOnly /></Field>
        <Field label="Amount"><input value={`$${selectedInvoice.amount.toLocaleString()}`} readOnly /></Field>
        <Field label="Due date"><input value={selectedInvoice.due} readOnly /></Field>
        <Field label="Sent date"><input name="sentDate" type="date" defaultValue={selectedInvoice.sentIso || ""} /></Field>
        <Field label="Paid"><select name="paid" defaultValue={selectedInvoice.paid ? "true" : "false"}><option value="false">Not paid</option><option value="true">Paid</option></select></Field>
        <Field label="Paid date"><input name="paidDate" type="date" defaultValue={selectedInvoice.paidDateIso || ""} /></Field>
      </form>}
    </Modal>
    <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add invoice" description="Create a backend invoice and show it in the ledger immediately." footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" form="invoice-ledger-add-form">Save invoice</Button></>}>
      <form id="invoice-ledger-add-form" className="form-grid" action={saveNewInvoice}>
        {invoiceError && <div className="field full"><div className="login-error">{invoiceError}</div></div>}
        <Field label="Client *"><select name="client" required defaultValue=""><option value="" disabled>Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.businessName}</option>)}</select></Field>
        <Field label="Billing month *"><input name="billingMonth" type="month" defaultValue={new Date().toISOString().slice(0, 7)} required /></Field>
        <Field label="Amount *"><input name="amount" type="number" min="0" defaultValue={0} required /></Field>
        <Field label="Issue date"><input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
        <Field label="Due date *"><input name="dueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
        <Field label="Sent date"><input name="sentDate" type="date" /></Field>
        <Field label="Paid"><select name="paid" defaultValue="false"><option value="false">Not paid</option><option value="true">Paid</option></select></Field>
        <Field label="Paid date"><input name="paidDate" type="date" /></Field>
      </form>
    </Modal>
  </>;
}
