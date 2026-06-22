"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Ellipsis, Filter, Pencil, Trash2 } from "lucide-react";
import { activities, clients, services } from "@/lib/demo-data";
import type { ActivityRecord, Status } from "@/lib/types";
import { AddButton, Badge, Button, Field, Modal, PageHeader, SearchField } from "./ui";

type OperationType = "contacts" | "reports" | "complaints" | "upsells";
type OperationKind = "Contact" | "Report" | "Complaint" | "Upsell";
type OperationStatus = ActivityRecord["status"];
type Config = { kind: OperationKind; eyebrow: string; title: string; description: string; add: string };
type OperationRow = ActivityRecord & { dateIso: string; notes: string };
type Draft = { client: string; dateIso: string; detail: string; notes: string; owner: string; status: OperationStatus; value: number };

const tone = (status: Status | "In Progress") => status === "Resolved" || status === "Converted" || status === "Sent" ? "success" : status === "Open" || status === "Late" ? "danger" : status === "Pending" || status === "In Progress" ? "warning" : "neutral";
const statusOptions: Record<OperationType, OperationStatus[]> = {
  contacts: ["Resolved"],
  reports: ["Pending", "Sent", "Late"],
  complaints: ["Open", "Resolved"],
  upsells: ["In Progress", "Converted", "Lost"],
};

function makeSeed(kind: OperationKind): OperationRow[] {
  return Array.from({ length: 7 }, (_, index) => {
    const base = activities[index % activities.length];
    const status = kind === "Contact" ? "Resolved" : kind === "Report" ? index % 3 ? "Sent" : "Pending" : kind === "Complaint" ? index % 2 ? "Resolved" : "Open" : index % 3 === 0 ? "Converted" : index % 3 === 1 ? "In Progress" : "Lost";
    return {
      ...base,
      id: `${kind}-${index + 1}`,
      kind,
      client: clients[index % clients.length].businessName,
      date: `Jun ${20 - index}, 2026`,
      dateIso: `2026-06-${String(20 - index).padStart(2, "0")}`,
      detail: kind === "Contact" ? ["Phone call", "Email", "WhatsApp"][index % 3] : kind === "Report" ? ["Retention Report 1", "Retention Report 2", "Onboarding Week 1"][index % 3] : kind === "Complaint" ? ["Tracking discrepancy", "Creative revision delay", "Response-time concern"][index % 3] : ["YouTube optimization", "Community Management", "Google Ads expansion"][index % 3],
      notes: kind === "Contact" ? "Weekly client check-in completed." : "Record created from the operational workflow.",
      status: status as OperationStatus,
      value: kind === "Upsell" ? [1200, 850, 2000][index % 3] : undefined,
    };
  });
}

function emptyDraft(type: OperationType): Draft {
  return {
    client: clients[0].businessName,
    dateIso: "2026-06-20",
    detail: type === "contacts" ? "Phone call" : type === "reports" ? "Retention Report 1" : "",
    notes: "",
    owner: "Arham",
    status: statusOptions[type][0],
    value: 0,
  };
}

export function OperationsView({ type, initialStatus = "All", initialFrom = "", initialTo = "" }: { type: OperationType; initialStatus?: string; initialFrom?: string; initialTo?: string }) {
  const config: Config = operationConfigs[type];
  const storageKey = `cst-crm-${type}`;
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<OperationRow[]>(() => makeSeed(config.kind));
  const [modal, setModal] = useState<"add" | "detail" | "edit" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(type));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [clientFilter, setClientFilter] = useState("All");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [minRevenue, setMinRevenue] = useState("");
  const [maxRevenue, setMaxRevenue] = useState("");

  const cstOwners = useMemo(() => Array.from(new Set(rows.map((row) => row.owner))).sort(), [rows]);
  const clientNames = useMemo(() => clients.map((client) => client.businessName).sort(), []);
  const clientByName = useMemo(() => new Map(clients.map((client) => [client.businessName, client])), []);
  const serviceOptions = useMemo(() => type === "upsells" ? Array.from(new Set(rows.map((row) => row.detail))).sort() : services, [rows, type]);
  const clientRevenue = (clientName: string) => clientByName.get(clientName)?.mrr ?? 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setRows(JSON.parse(stored) as OperationRow[]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  const persist = (next: OperationRow[]) => {
    setRows(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  };
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const visibleRows = useMemo(() => rows.filter((row) => {
    const client = clientByName.get(row.client);
    const clientServices = client?.services ?? [];
    const revenue = type === "upsells" ? row.value ?? 0 : client?.mrr ?? 0;
    const min = minRevenue ? Number(minRevenue) : null;
    const max = maxRevenue ? Number(maxRevenue) : null;
    const matchesQuery = `${row.client} ${row.detail} ${row.owner} ${row.notes} ${clientServices.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const matchesOwner = ownerFilter === "All" || row.owner === ownerFilter;
    const matchesClient = clientFilter === "All" || row.client === clientFilter;
    const matchesService = serviceFilter === "All" || (type === "upsells" ? row.detail === serviceFilter || clientServices.includes(serviceFilter) : clientServices.includes(serviceFilter));
    const matchesRevenue = (min === null || revenue >= min) && (max === null || revenue <= max);
    return matchesQuery && matchesOwner && matchesClient && matchesService && matchesRevenue && (statusFilter === "All" || row.status === statusFilter) && (!from || row.dateIso >= from) && (!to || row.dateIso <= to);
  }), [clientByName, clientFilter, from, maxRevenue, minRevenue, ownerFilter, query, rows, serviceFilter, statusFilter, to, type]);

  const stats = useMemo(() => {
    if (type === "contacts") return [["Contacts logged", rows.length], ["Clients reached", new Set(rows.map((row) => row.client)).size], ["Phone calls", rows.filter((row) => row.detail === "Phone call").length], ["This view", visibleRows.length]];
    if (type === "reports") return [["Total reports", visibleRows.length], ["Sent", visibleRows.filter((row) => row.status === "Sent").length], ["Pending", visibleRows.filter((row) => row.status === "Pending").length], ["Late", visibleRows.filter((row) => row.status === "Late").length]];
    if (type === "complaints") return [["Total logged", visibleRows.length], ["Resolved", visibleRows.filter((row) => row.status === "Resolved").length], ["Still open", visibleRows.filter((row) => row.status === "Open").length], ["Resolution rate", `${visibleRows.length ? Math.round(visibleRows.filter((row) => row.status === "Resolved").length / visibleRows.length * 100) : 0}%`]];
    return [["Pipeline", `$${visibleRows.filter((row) => row.status === "In Progress").reduce((sum, row) => sum + (row.value ?? 0), 0).toLocaleString()}`], ["Converted", visibleRows.filter((row) => row.status === "Converted").length], ["Revenue", `$${visibleRows.filter((row) => row.status === "Converted").reduce((sum, row) => sum + (row.value ?? 0), 0).toLocaleString()}`], ["Lost", visibleRows.filter((row) => row.status === "Lost").length]];
  }, [type, visibleRows]);

  const openAdd = () => { setSelectedId(null); setDraft(emptyDraft(type)); setModal("add"); };
  const openDetail = (row: OperationRow) => { setSelectedId(row.id); setModal("detail"); };
  const openEdit = () => {
    if (!selected) return;
    setDraft({ client: selected.client, dateIso: selected.dateIso, detail: selected.detail, notes: selected.notes, owner: selected.owner, status: selected.status, value: selected.value ?? 0 });
    setModal("edit");
  };
  const save = () => {
    if (!draft.client || !draft.dateIso || !draft.detail.trim()) return;
    const row: OperationRow = {
      id: selectedId ?? `${config.kind}-${Date.now()}`,
      kind: config.kind,
      client: draft.client,
      dateIso: draft.dateIso,
      date: new Date(`${draft.dateIso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      detail: draft.detail.trim(),
      notes: draft.notes.trim(),
      owner: draft.owner,
      status: draft.status,
      value: type === "upsells" ? Number(draft.value) : undefined,
    };
    persist(selectedId ? rows.map((item) => item.id === selectedId ? row : item) : [row, ...rows]);
    setModal(null);
  };
  const setSelectedStatus = (status: OperationStatus) => {
    if (!selected) return;
    persist(rows.map((row) => row.id === selected.id ? { ...row, status } : row));
    setModal("detail");
  };
  const removeSelected = () => {
    if (!selected) return;
    persist(rows.filter((row) => row.id !== selected.id));
    setModal(null);
  };
  const exportCsv = () => {
    const csv = [["Client", "Record", "Date", "Owner", "Status", "Revenue", "Notes"], ...visibleRows.map((row) => [row.client, row.detail, row.dateIso, row.owner, row.status, String(row.value ?? ""), row.notes])]
      .map((line) => line.map((value) => `"${value.replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${type}-export.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return <><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} action={<AddButton onClick={openAdd} testId={`add-${config.kind.toLowerCase()}`}>{config.add}</AddButton>} secondary={<Button variant="secondary" onClick={exportCsv}><Download size={15} />Export CSV</Button>} />
    <section className="mini-stats">{stats.map(([label, value]) => <div className="mini-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</section>
    <section className="panel" data-testid={`${config.kind.toLowerCase()}-table`}>
      <div className="toolbar"><div className="toolbar-group"><SearchField value={query} onChange={setQuery} placeholder={`Search ${config.title.toLowerCase()}…`} /><Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}><Filter size={15} />Filters</Button></div></div>
      {filtersOpen && <div className="operation-filters">{type !== "upsells" && <Field label="Status"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{statusOptions[type].map((status) => <option key={status}>{status}</option>)}</select></Field>}<Field label="CST person"><select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option>All</option>{cstOwners.map((owner) => <option key={owner}>{owner}</option>)}</select></Field><Field label="Client"><select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option>All</option>{clientNames.map((client) => <option key={client}>{client}</option>)}</select></Field>{(type === "reports" || type === "complaints" || type === "upsells") && <Field label="Service"><select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option>All</option>{serviceOptions.map((service) => <option key={service}>{service}</option>)}</select></Field>}{(type === "complaints" || type === "upsells") && <><Field label="Revenue from"><input type="number" min="0" value={minRevenue} onChange={(event) => setMinRevenue(event.target.value)} placeholder={type === "upsells" ? "Minimum revenue" : "Minimum MRR"} /></Field><Field label="Revenue to"><input type="number" min="0" value={maxRevenue} onChange={(event) => setMaxRevenue(event.target.value)} placeholder={type === "upsells" ? "Maximum revenue" : "Maximum MRR"} /></Field></>}{type !== "upsells" && <><Field label="From"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="To"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field></>}</div>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>{config.kind === "Contact" ? "Channel" : config.kind === "Upsell" ? "Service pitched" : "Record"}</th><th>Date</th><th>Owner</th>{(config.kind === "Upsell" || config.kind === "Complaint") && <th>Revenue</th>}<th>Status</th><th /></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id}><td><strong>{row.client}</strong></td><td>{row.detail}</td><td>{row.date}</td><td>{row.owner}</td>{config.kind === "Upsell" && <td><strong>${row.value?.toLocaleString()}</strong></td>}{config.kind === "Complaint" && <td><strong>${clientRevenue(row.client).toLocaleString()}</strong></td>}<td><Badge tone={tone(row.status)}>{row.status}</Badge></td><td><button className="table-action" onClick={() => openDetail(row)} aria-label={`Open ${config.kind.toLowerCase()} for ${row.client}`}><Ellipsis size={16} /></button></td></tr>)}</tbody></table>{visibleRows.length === 0 && <div className="inline-empty">No matching records</div>}</div>
    </section>

    <Modal open={modal === "add" || modal === "edit"} onClose={() => setModal(null)} title={modal === "edit" ? `Edit ${config.kind.toLowerCase()}` : config.add} description={`Save a raw ${config.kind.toLowerCase()} record for computed dashboards.`} footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={save}><CheckCircle2 size={15} />Save record</Button></>}>
      <OperationForm type={type} draft={draft} setDraft={setDraft} />
    </Modal>
    <Modal open={modal === "detail" && Boolean(selected)} onClose={() => setModal(null)} title={`${config.kind} details`} description={selected ? `${selected.client} · ${selected.date}` : undefined} footer={<><Button variant="danger" onClick={removeSelected}><Trash2 size={14} />Delete</Button><Button variant="secondary" onClick={openEdit}><Pencil size={14} />Edit</Button>{selected && type === "reports" && selected.status !== "Sent" && <Button onClick={() => setSelectedStatus("Sent")}>Mark sent</Button>}{selected && type === "complaints" && <Button onClick={() => setSelectedStatus(selected.status === "Resolved" ? "Open" : "Resolved")}>{selected.status === "Resolved" ? "Reopen" : "Resolve"}</Button>}{selected && type === "upsells" && selected.status === "In Progress" && <><Button variant="secondary" onClick={() => setSelectedStatus("Lost")}>Mark lost</Button><Button onClick={() => setSelectedStatus("Converted")}>Convert</Button></>}</>}>
      {selected && <div className="detail-list"><div><span>Client</span><strong>{selected.client}</strong></div><div><span>Status</span><Badge tone={tone(selected.status)}>{selected.status}</Badge></div><div><span>{type === "contacts" ? "Channel" : type === "upsells" ? "Service pitched" : "Record"}</span><strong>{selected.detail}</strong></div><div><span>Date</span><strong>{selected.date}</strong></div><div><span>Owner</span><strong>{selected.owner}</strong></div>{type === "upsells" && <div><span>Revenue</span><strong>${selected.value?.toLocaleString()}</strong></div>}{type === "complaints" && <div><span>Client revenue</span><strong>${clientRevenue(selected.client).toLocaleString()}</strong></div>}<div><span>Notes</span><strong>{selected.notes || "No notes"}</strong></div></div>}
    </Modal>
  </>;
}

function OperationForm({ type, draft, setDraft }: { type: OperationType; draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>> }) {
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="form-grid"><Field label="Client"><select value={draft.client} onChange={(event) => update("client", event.target.value)}>{clients.map((client) => <option key={client.id}>{client.businessName}</option>)}</select></Field><Field label="Date"><input type="date" value={draft.dateIso} onChange={(event) => update("dateIso", event.target.value)} /></Field>
    {type === "contacts" && <Field label="Channel"><select value={draft.detail} onChange={(event) => update("detail", event.target.value)}><option>Phone call</option><option>Email</option><option>WhatsApp</option><option>Video meeting</option></select></Field>}
    {type === "reports" && <Field label="Report label"><select value={draft.detail} onChange={(event) => update("detail", event.target.value)}><option>Retention Report 1</option><option>Retention Report 2</option><option>Onboarding Week 1</option><option>Onboarding Biweekly</option><option>Onboarding Monthly</option></select></Field>}
    {type === "complaints" && <Field label="Complaint details"><input value={draft.detail} onChange={(event) => update("detail", event.target.value)} placeholder="Describe the issue" /></Field>}
    {type === "upsells" && <><Field label="Service pitched"><input value={draft.detail} onChange={(event) => update("detail", event.target.value)} placeholder="Service" /></Field><Field label="Revenue"><input type="number" min="0" value={draft.value} onChange={(event) => update("value", Number(event.target.value))} /></Field></>}
    <Field label="Owner"><select value={draft.owner} onChange={(event) => update("owner", event.target.value)}><option>Arham</option><option>Hira</option><option>Sameer</option><option>Asad</option></select></Field>
    {type !== "contacts" && <Field label="Status"><select value={draft.status} onChange={(event) => update("status", event.target.value as OperationStatus)}>{statusOptions[type].map((status) => <option key={status}>{status}</option>)}</select></Field>}
    <div className="field full"><Field label="Notes"><textarea value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Add context…" /></Field></div>
  </div>;
}

const operationConfigs: Record<OperationType, Config> = {
  contacts: { kind: "Contact", eyebrow: "Client engagement", title: "Contact log", description: "Weekly touch records reset automatically by date. Target: 3 per eligible client.", add: "Log contact" },
  reports: { kind: "Report", eyebrow: "Scheduled deliverables", title: "Reports", description: "Retention and onboarding reports with monthly status tracking.", add: "Log report" },
  complaints: { kind: "Complaint", eyebrow: "Issue resolution", title: "Complaints", description: "One source record per complaint from raised date through resolution.", add: "Log complaint" },
  upsells: { kind: "Upsell", eyebrow: "Expansion pipeline", title: "Upsells", description: "Track pitches, conversions, lost opportunities, and new revenue.", add: "New opportunity" },
};
