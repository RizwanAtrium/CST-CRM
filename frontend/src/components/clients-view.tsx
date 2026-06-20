"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Ellipsis, Filter } from "lucide-react";
import { clients as seedClients } from "@/lib/demo-data";
import type { Stage } from "@/lib/types";
import { AddButton, Avatar, Badge, Button, Field, Modal, PageHeader, SearchField } from "./ui";

const tone = (stage: Stage) => stage === "Active" ? "success" : stage === "In Progress" ? "warning" : "neutral";

export function ClientsView({ initialQuery = "", initialStage = "All" }: { initialQuery?: string; initialStage?: "All" | Stage }) {
  const [clients, setClients] = useState(seedClients);
  const [query, setQuery] = useState(initialQuery);
  const [stage, setStage] = useState<"All" | Stage>(initialStage);
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = useMemo(() => clients.filter((client) => (stage === "All" || client.stage === stage) && `${client.businessName} ${client.customerName} ${client.email}`.toLowerCase().includes(query.toLowerCase())), [clients, query, stage]);

  function addClient() {
    setClients([{ id: `CL-${1000 + clients.length + 1}`, businessName: "New client workspace", customerName: "Primary contact", email: "hello@example.com", phone: "—", handler: "Unassigned", stage: "In Progress", mrr: 0, workStart: "2026-06-20", services: [], health: 75 }, ...clients]);
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
    <Modal open={open} onClose={() => setOpen(false)} title="Add new client" description="Start a paying client in the 0–30 day onboarding pipeline." footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={addClient}>Create client</Button></>}><div className="form-grid"><Field label="Business name"><input placeholder="Acme Inc." /></Field><Field label="Customer name"><input placeholder="Primary contact" /></Field><Field label="Email"><input type="email" placeholder="client@company.com" /></Field><Field label="Contact number"><input placeholder="+1 000 000 0000" /></Field><Field label="Work start date"><input type="date" defaultValue="2026-06-20" /></Field><Field label="CST handler"><select><option>Arham</option><option>Hira</option><option>Sameer</option></select></Field></div></Modal>
  </>;
}
