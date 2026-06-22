"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { Download, Ellipsis, Filter } from "lucide-react";
import { clients as seedClients } from "@/lib/demo-data";
import type { Stage } from "@/lib/types";
import { AddButton, Avatar, Badge, Button, Field, Modal, PageHeader, SearchField } from "./ui";

const tone = (stage: Stage) => stage === "Active" ? "success" : stage === "In Progress" ? "warning" : "neutral";

type ServiceDraft = { name: string; price: string };
const blankService = (): ServiceDraft => ({ name: "", price: "" });

export function ClientsView({ initialQuery = "", initialStage = "All" }: { initialQuery?: string; initialStage?: "All" | Stage }) {
  const [clients, setClients] = useState(seedClients);
  const [query, setQuery] = useState(initialQuery);
  const [stage, setStage] = useState<"All" | Stage>(initialStage);
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [servicesDraft, setServicesDraft] = useState<ServiceDraft[]>([blankService()]);
  const filtered = useMemo(() => clients.filter((client) => (stage === "All" || client.stage === stage) && `${client.businessName} ${client.customerName} ${client.email}`.toLowerCase().includes(query.toLowerCase())), [clients, query, stage]);

  function updateService(index: number, key: keyof ServiceDraft, value: string) {
    setServicesDraft((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  function addServiceLine() {
    setServicesDraft((items) => [...items, blankService()]);
  }

  function removeServiceLine(index: number) {
    setServicesDraft((items) => items.length === 1 ? [blankService()] : items.filter((_, itemIndex) => itemIndex !== index));
  }

  function resetClientForm() {
    setServicesDraft([blankService()]);
  }

  function addClient(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const form = event?.currentTarget ? new FormData(event.currentTarget) : undefined;
    const cleanServices = servicesDraft
      .map((service) => ({ name: service.name.trim(), price: Number(service.price || 0) }))
      .filter((service) => service.name || service.price > 0);
    const totalPaid = cleanServices.reduce((sum, service) => sum + service.price, 0);
    const createdClient = {
      id: `CL-${1000 + clients.length + 1}`,
      businessName: String(form?.get("businessName") || "New client workspace"),
      customerName: String(form?.get("customerName") || "Primary contact"),
      email: String(form?.get("email") || "hello@example.com"),
      phone: String(form?.get("phone") || "—"),
      mobile: String(form?.get("mobile") || ""),
      businessAddress: String(form?.get("businessAddress") || ""),
      handler: String(form?.get("handler") || "Unassigned"),
      stage: "In Progress" as Stage,
      mrr: totalPaid,
      workStart: "Pending production go-ahead",
      services: cleanServices.map((service) => `${service.name || "Service"} ($${service.price.toLocaleString()})`),
      health: 75,
    };
    setClients([createdClient, ...clients]);
    resetClientForm();
    setOpen(false);
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

  return <>
    <PageHeader eyebrow="Client operations" title="Clients" description={`${clients.length} total accounts · $${clients.reduce((sum, item) => sum + item.mrr, 0).toLocaleString()} portfolio MRR`} action={<AddButton onClick={() => setOpen(true)} testId="add-client">Add client</AddButton>} secondary={<Button variant="secondary" onClick={exportClients}><Download size={16} />Export</Button>} />
    <section className="mini-stats"><div className="mini-stat"><span>Active clients</span><strong>47</strong></div><div className="mini-stat"><span>In onboarding</span><strong>6</strong></div><div className="mini-stat"><span>4+ months active</span><strong>31</strong></div><div className="mini-stat"><span>Average health</span><strong>84%</strong></div></section>
    <section className="panel" data-testid="clients-table">
      <div className="toolbar"><div className="toolbar-group"><SearchField value={query} onChange={setQuery} placeholder="Search clients…" /><Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}><Filter size={15} />Filters</Button></div><div className="filter-tabs">{(["All", "Active", "In Progress", "Not Active"] as const).map((value) => <button className={stage === value ? "active" : ""} key={value} onClick={() => setStage(value)}>{value}</button>)}</div></div>
      {filtersOpen && <div className="operation-filters"><Field label="Lifecycle stage"><select value={stage} onChange={(event) => setStage(event.target.value as "All" | Stage)}><option>All</option><option>Active</option><option>In Progress</option><option>Not Active</option></select></Field><Button variant="ghost" onClick={() => { setStage("All"); setQuery(""); }}>Clear filters</Button></div>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Stage</th><th>CST handler</th><th>Services</th><th>MRR</th><th>Health</th><th /></tr></thead><tbody>{filtered.map((client, index) => <tr key={client.id}><td><Link className="cell-person row-link" href={`/clients/${client.id}`}><Avatar name={client.businessName} tone={index % 3 === 0 ? "violet" : index % 3 === 1 ? "green" : "blue"} /><div><strong>{client.businessName}</strong><span>{client.customerName} · {client.id}</span></div></Link></td><td><Badge tone={tone(client.stage)}>{client.stage}</Badge></td><td>{client.handler}</td><td>{client.services.length ? client.services.slice(0, 2).join(", ") : "No services"}{client.services.length > 2 ? ` +${client.services.length - 2}` : ""}</td><td><strong>${client.mrr.toLocaleString()}</strong></td><td><div style={{ display: "flex", alignItems: "center", gap: 7 }}><div className="progress" style={{ width: 48 }}><i style={{ width: `${client.health}%`, background: client.health > 80 ? "var(--green)" : client.health > 65 ? "var(--amber)" : "var(--red)" }} /></div><span>{client.health}</span></div></td><td><Link className="table-action table-action-link" href={`/clients/${client.id}`} aria-label={`Open ${client.businessName}`}><Ellipsis size={16} /></Link></td></tr>)}</tbody></table></div>
    </section>
    <Modal open={open} onClose={() => { setOpen(false); resetClientForm(); }} title="Add new client" description="Create the client profile first. Work start date stays pending until production gives the go-ahead." footer={<><Button variant="secondary" type="button" onClick={() => { setOpen(false); resetClientForm(); }}>Cancel</Button><Button type="submit" form="add-client-form">Create client</Button></>}>
      <form id="add-client-form" onSubmit={addClient}>
        <div className="form-grid">
          <Field label="Business name"><input name="businessName" placeholder="Acme Inc." required /></Field>
          <Field label="Customer name"><input name="customerName" placeholder="Primary contact" required /></Field>
          <Field label="Email"><input name="email" type="email" placeholder="client@company.com" required /></Field>
          <Field label="Phone number"><input name="phone" placeholder="+1 000 000 0000" required /></Field>
          <Field label="Mobile"><input name="mobile" placeholder="+1 000 000 0000" /></Field>
          <Field label="CST handler"><select name="handler"><option>Arham</option><option>Hira</option><option>Sameer</option><option>Unassigned</option></select></Field>
          <Field label="Business address"><textarea name="businessAddress" placeholder="Street, city, state, ZIP" /></Field>
          <Field label="Production go-ahead"><input value="Work start date pending" readOnly aria-label="Work start date pending" /></Field>
        </div>
        <div className="service-builder">
          <div className="section-title-row"><div><strong>Services agreed and paid</strong><span>Add each service and the amount paid for it.</span></div><Button type="button" variant="secondary" onClick={addServiceLine}>+ Add service</Button></div>
          {servicesDraft.map((service, index) => <div className="service-row" key={index}>
            <input value={service.name} onChange={(event) => updateService(index, "name", event.target.value)} placeholder="Service name" required={index === 0} />
            <input value={service.price} onChange={(event) => updateService(index, "price", event.target.value)} type="number" min="0" step="1" placeholder="Price paid" required={index === 0} />
            <Button type="button" variant="ghost" onClick={() => removeServiceLine(index)}>Remove</Button>
          </div>)}
          <div className="total-line"><span>Total paid</span><strong>${servicesDraft.reduce((sum, service) => sum + Number(service.price || 0), 0).toLocaleString()}</strong></div>
        </div>
        <Field label="Client notes/details"><textarea name="notes" placeholder="Services agreed, payment context, sales handoff notes, access details..." /></Field>
      </form>
    </Modal>
  </>;
}
