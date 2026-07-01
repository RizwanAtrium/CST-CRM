"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Ellipsis, Filter } from "lucide-react";
import { crmApi, onCrmDataChanged } from "@/lib/api";
import type { Client, Stage } from "@/lib/types";
import { AddButton, Avatar, Badge, Button, Field, Modal, PageHeader, SearchField } from "./ui";

const tone = (stage: Stage) => stage === "Active" ? "success" : stage === "In Progress" ? "warning" : "neutral";

export function ClientsView({ initialQuery = "", initialStage = "All" }: { initialQuery?: string; initialStage?: "All" | Stage }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(initialQuery);
  const [stage, setStage] = useState<"All" | Stage>(initialStage);
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [handlerFilter, setHandlerFilter] = useState("All");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetchClients = useCallback(() => {
    setLoading(true);
    crmApi.clients()
      .then(setClients)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { void Promise.resolve().then(fetchClients); }, [fetchClients]);
  useEffect(() => onCrmDataChanged(fetchClients), [fetchClients]);

  const handlers = useMemo(() => Array.from(new Set(clients.map((client) => client.handler))).sort(), [clients]);
  const services = useMemo(() => Array.from(new Set(clients.flatMap((client) => client.services))).sort(), [clients]);
  const filtered = useMemo(() => clients.filter((client) => {
    const date = client.workStart ? new Date(client.workStart).toISOString().slice(0, 10) : "";
    return (stage === "All" || client.stage === stage)
      && (handlerFilter === "All" || client.handler === handlerFilter)
      && (serviceFilter === "All" || client.services.includes(serviceFilter))
      && (!from || !date || date >= from)
      && (!to || !date || date <= to)
      && `${client.businessName} ${client.customerName} ${client.email} ${client.handler} ${client.services.join(" ")}`.toLowerCase().includes(query.toLowerCase());
  }), [clients, query, stage, handlerFilter, serviceFilter, from, to]);

  function clearFilters() {
    setQuery("");
    setStage("All");
    setHandlerFilter("All");
    setServiceFilter("All");
    setFrom("");
    setTo("");
  }

  function addClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    crmApi.createClient({
      businessName: String(data.get("businessName") || "New client workspace"),
      customerName: String(data.get("customerName") || "Primary contact"),
      email: String(data.get("email") || "hello@example.com"),
      contactNumber: String(data.get("phone") || "—"),
      mobileNumber: String(data.get("mobile") || ""),
      address: String(data.get("businessAddress") || ""),
      niche: String(data.get("niche") || ""),
      saleDate: new Date().toISOString(),
    }).then(() => {
      fetchClients();
      setOpen(false);
      form.reset();
    }).catch(() => undefined);
  }

  function exportClients() {
    const csv = [["Client ID", "Business", "Customer", "Email", "Stage", "Handler", "MRR"], ...filtered.map((client) => [client.id, client.businessName, client.customerName, client.email, client.stage, client.handler, String(client.mrr)])]
      .map((row) => row.map((value) => `"${value.replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "clients-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalMrr = useMemo(() => clients.reduce((sum, item) => sum + item.mrr, 0), [clients]);
  const activeClients = useMemo(() => clients.filter((c) => c.stage === "Active").length, [clients]);
  const inProgress = useMemo(() => clients.filter((c) => c.stage === "In Progress").length, [clients]);
  const avgHealth = useMemo(() => clients.length ? Math.round(clients.reduce((s, c) => s + c.health, 0) / clients.length) : 0, [clients]);

  if (loading) {
    return <div className="state-card" data-testid="loading-state"><strong>Loading clients</strong><p>Fetching from CRM…</p></div>;
  }

  return <>
    <PageHeader eyebrow="Client operations" title="Clients" description={`${clients.length} total accounts · $${totalMrr.toLocaleString()} portfolio MRR`} action={<AddButton onClick={() => setOpen(true)} testId="add-client">Add client</AddButton>} secondary={<Button variant="secondary" onClick={exportClients}><Download size={16} />Export</Button>} />
    <section className="mini-stats"><div className="mini-stat"><span>Active clients</span><strong>{activeClients}</strong></div><div className="mini-stat"><span>In onboarding</span><strong>{inProgress}</strong></div><div className="mini-stat"><span>Total clients</span><strong>{clients.length}</strong></div><div className="mini-stat"><span>Average health</span><strong>{avgHealth}%</strong></div></section>
    <section className="panel" data-testid="clients-table">
      <div className="toolbar"><div className="toolbar-group"><SearchField value={query} onChange={setQuery} placeholder="Search clients…" /><Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}><Filter size={15} />Filters</Button></div><div className="filter-tabs">{(["All", "Active", "In Progress", "Not Active"] as const).map((value) => <button className={stage === value ? "active" : ""} key={value} onClick={() => setStage(value)}>{value}</button>)}</div></div>
      {filtersOpen && <div className="operation-filters"><Field label="Lifecycle stage"><select value={stage} onChange={(event) => setStage(event.target.value as "All" | Stage)}><option>All</option><option>Active</option><option>In Progress</option><option>Not Active</option></select></Field><Field label="CST person"><select value={handlerFilter} onChange={(event) => setHandlerFilter(event.target.value)}><option>All</option>{handlers.map((handler) => <option key={handler}>{handler}</option>)}</select></Field><Field label="Service"><select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option>All</option>{services.map((service) => <option key={service}>{service}</option>)}</select></Field><Field label="From"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="To"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field><Button variant="ghost" onClick={clearFilters}>Clear filters</Button></div>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Stage</th><th>NICHE</th><th>CST handler</th><th>Services</th><th>MRR</th><th>Health</th><th /></tr></thead><tbody>{filtered.map((client, index) => <tr key={client.id}><td><Link className="cell-person row-link" href={`/clients/${client.id}`}><Avatar name={client.businessName} tone={index % 3 === 0 ? "violet" : index % 3 === 1 ? "green" : "blue"} /><div><strong>{client.businessName}</strong><span>{client.customerName} · {client.id}</span></div></Link></td><td><Badge tone={tone(client.stage)}>{client.stage}</Badge></td><td>{client.niche}</td><td>{client.handler}</td><td>{client.services.length ? client.services.slice(0, 2).join(", ") : "No services"}{client.services.length > 2 ? ` +${client.services.length - 2}` : ""}</td><td><strong>${client.mrr.toLocaleString()}</strong></td><td><div style={{ display: "flex", alignItems: "center", gap: 7 }}><div className="progress" style={{ width: 48 }}><i style={{ width: `${client.health}%`, background: client.health > 80 ? "var(--green)" : client.health > 65 ? "var(--amber)" : "var(--red)" }} /></div><span>{client.health}</span></div></td><td><Link className="table-action table-action-link" href={`/clients/${client.id}`} aria-label={`Open ${client.businessName}`}><Ellipsis size={16} /></Link></td></tr>)}</tbody></table></div>
    </section>
    <Modal open={open} onClose={() => { setOpen(false); }} title="Add new client" description="Create the client profile first." footer={<><Button variant="secondary" type="button" onClick={() => { setOpen(false); }}>Cancel</Button><Button type="submit" form="add-client-form">Create client</Button></>}>
      <form id="add-client-form" onSubmit={addClient}>
        <div className="form-grid">
          <Field label="Business name"><input name="businessName" placeholder="Acme Inc." required /></Field>
          <Field label="Customer name"><input name="customerName" placeholder="Primary contact" required /></Field>
          <Field label="Email"><input name="email" type="email" placeholder="client@company.com" required /></Field>
          <Field label="Phone number"><input name="phone" placeholder="+1 000 000 0000" required /></Field>
          <Field label="NICHE *"><input name="niche" placeholder="Dental, legal, roofing..." required /></Field>
          <Field label="Mobile"><input name="mobile" placeholder="+1 000 000 0000" /></Field>
          <Field label="Business address"><textarea name="businessAddress" placeholder="Street, city, state, ZIP" /></Field>
        </div>
      </form>
    </Modal>
  </>;
}
