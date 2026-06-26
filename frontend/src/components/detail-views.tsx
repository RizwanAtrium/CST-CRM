"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  HandCoins,
  Mail,
  MapPin,
  MessageSquareWarning,
  Pencil,
  Phone,
  Plus,
  Send,
  Smartphone,
  UserRound,
} from "lucide-react";
import {
  crmApi,
  type ApiAuditEntry,
  type ApiTeamUser,
  type BackendComplaint,
  type BackendContact,
  type BackendInvoice,
  type BackendOnboarding,
  type BackendReport,
  type BackendService,
  type BackendUpsell,
} from "@/lib/api";
import { getSession } from "@/lib/auth";
import type { Client, Stage, Status } from "@/lib/types";
import { Avatar, Badge, Button, Field, Modal, SearchField } from "./ui";

const stageTone = (stage: Stage) => stage === "Active" ? "success" : stage === "In Progress" ? "warning" : "neutral";
const statusTone = (status: Status | "In Progress") => status === "Paid" || status === "Sent" || status === "Resolved" || status === "Converted" ? "success" : status === "Late" || status === "Open" ? "danger" : status === "Pending" || status === "In Progress" || status === "Not Sent" ? "warning" : "neutral";

type ClientHistoryEntry = {
  id: string;
  time: string;
  dateIso?: string;
  actor: string;
  message: string;
  tag: string;
  recordId?: string;
  action: string;
  source?: string;
  before?: unknown;
  after?: unknown;
};

type DetailFilterRow = {
  text: string;
  status?: string;
  dateIso?: string;
};

const clientTabs = ["Overview", "Services", "Invoices", "Contacts", "Reports", "Complaints", "Upsells", "History"];
const detailStatusOptions: Record<string, string[]> = {
  Services: ["All", "Active"],
  Invoices: ["All", "Paid", "Sent", "Late", "Not Sent"],
  Contacts: ["All", "Resolved"],
  Reports: ["All", "Pending", "Sent", "Late"],
  Complaints: ["All", "Open", "Resolved"],
  Upsells: ["All", "In Progress", "Converted", "Lost"],
};

const formatDate = (value?: string | null) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const isoDate = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 10) : "";
const monthValue = (value?: string | null) => {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 7);
};
const monthDueDate = (periodMonth: string, day: number) => {
  const [year, month] = periodMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${periodMonth}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
};
const prettyJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const invoiceStatus = (invoice: BackendInvoice): Status => {
  if (invoice.paid) return "Paid";
  return (invoice.status as Status) ?? "Not Sent";
};

const actorName = (actor: ApiAuditEntry["actor"]) => {
  if (!actor) return "System";
  if (typeof actor === "string") return "User";
  return actor.name ?? actor.email ?? "User";
};

function matchesDetailFilters(row: DetailFilterRow, query: string, status: string, from: string, to: string) {
  const matchesQuery = row.text.toLowerCase().includes(query.trim().toLowerCase());
  const matchesStatus = status === "All" || row.status === status;
  const date = row.dateIso ?? "";
  const matchesFrom = !from || !date || date >= from;
  const matchesTo = !to || !date || date <= to;
  return matchesQuery && matchesStatus && matchesFrom && matchesTo;
}

function DetailHeader({
  back,
  eyebrow,
  title,
  subtitle,
  badge,
  children,
}: {
  back: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="detail-header">
      <div className="detail-heading">
        <Link href={back} className="back-link"><ArrowLeft size={15} />Back</Link>
        <span className="eyebrow">{eyebrow}</span>
        <div className="detail-title-row"><h1>{title}</h1>{badge}</div>
        <p>{subtitle}</p>
      </div>
      <div className="header-actions">{children}</div>
    </header>
  );
}

function TabBar({ tabs, active, setActive }: { tabs: string[]; active: string; setActive: (tab: string) => void }) {
  return <nav className="detail-tabs" aria-label="Record sections">{tabs.map((tab) => <button key={tab} className={active === tab ? "active" : ""} onClick={() => setActive(tab)}>{tab}</button>)}</nav>;
}

function EmptyInline({ text }: { text: string }) {
  return <div className="inline-empty"><CheckCircle2 size={20} /><span>{text}</span></div>;
}

export function ClientDetailView({ id }: { id: string }) {
  const session = getSession();
  const canAssignCstOwner = session?.user.role === "SUPER_ADMIN" || session?.user.role === "DIRECTOR";
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("Overview");
  const [editOpen, setEditOpen] = useState(false);
  const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
  const [selectedCstOwner, setSelectedCstOwner] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [addModal, setAddModal] = useState<null | "service" | "newService" | "invoice" | "contact" | "report" | "complaint" | "upsell">(null);
  const [selectedHistory, setSelectedHistory] = useState<ClientHistoryEntry | null>(null);
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [contacts, setContacts] = useState<BackendContact[]>([]);
  const [reports, setReports] = useState<BackendReport[]>([]);
  const [complaints, setComplaints] = useState<BackendComplaint[]>([]);
  const [upsells, setUpsells] = useState<BackendUpsell[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<BackendService[]>([]);
  const [teamUsers, setTeamUsers] = useState<ApiTeamUser[]>([]);
  const [history, setHistory] = useState<ApiAuditEntry[]>([]);
  const [detailQuery, setDetailQuery] = useState("");
  const [detailStatus, setDetailStatus] = useState("All");
  const [detailFrom, setDetailFrom] = useState("");
  const [detailTo, setDetailTo] = useState("");
  const [detailFiltersOpen, setDetailFiltersOpen] = useState(false);
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10));
  const [tomorrowIso] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() + 1);
    return value.toISOString().slice(0, 10);
  });

  const fetchClient = useCallback(() => {
    setLoading(true);
    crmApi.client(id)
      .then(async (clientData) => {
        setClient(clientData);
        const clientQuery = `?client=${encodeURIComponent(clientData.id)}&limit=100`;
        const [invoiceRows, contactRows, reportRows, complaintRows, upsellRows, serviceRows, historyRows, teamRows] = await Promise.all([
          crmApi.rawInvoices(clientQuery),
          crmApi.contacts(clientQuery),
          crmApi.reports(clientQuery),
          crmApi.complaints(clientQuery),
          crmApi.upsells(clientQuery),
          crmApi.rawServices(),
          crmApi.clientHistory(clientData.id).catch(() => []),
          canAssignCstOwner ? crmApi.teamUsers().catch(() => []) : Promise.resolve([]),
        ]);
        setInvoices(invoiceRows);
        setContacts(contactRows);
        setReports(reportRows);
        setComplaints(complaintRows);
        setUpsells(upsellRows);
        setServiceCatalog(serviceRows.filter((service) => service.active));
        setHistory(historyRows);
        setTeamUsers(teamRows);
      })
      .catch(() => {
        setClient(null);
        setInvoices([]);
        setContacts([]);
        setReports([]);
        setComplaints([]);
        setUpsells([]);
        setServiceCatalog([]);
        setTeamUsers([]);
        setHistory([]);
      })
      .finally(() => setLoading(false));
  }, [id, canAssignCstOwner]);

  useEffect(() => { void Promise.resolve().then(fetchClient); }, [fetchClient]);

  const visibleServices = useMemo(
    () => (client?.services ?? []).filter((service) => matchesDetailFilters({ text: service, status: "Active" }, detailQuery, detailStatus, detailFrom, detailTo)),
    [client, detailQuery, detailStatus, detailFrom, detailTo],
  );
  const visibleInvoices = useMemo(
    () => invoices.filter((invoice) => matchesDetailFilters({ text: `${invoice._id} ${invoice.billingMonth} ${invoice.amount} ${invoiceStatus(invoice)}`, status: invoiceStatus(invoice), dateIso: isoDate(invoice.dueDate) }, detailQuery, detailStatus, detailFrom, detailTo)),
    [invoices, detailQuery, detailStatus, detailFrom, detailTo],
  );
  const visibleContacts = useMemo(
    () => contacts.filter((contact) => matchesDetailFilters({ text: `${contact.contactType} ${contact.channel} ${contact.notes}`, status: "Resolved", dateIso: isoDate(contact.contactDate) }, detailQuery, detailStatus, detailFrom, detailTo)),
    [contacts, detailQuery, detailStatus, detailFrom, detailTo],
  );
  const visibleReports = useMemo(
    () => reports.filter((report) => matchesDetailFilters({ text: `${report.category} ${report.label} ${report.periodMonth} ${report.status}`, status: report.status, dateIso: isoDate(report.dueDate) }, detailQuery, detailStatus, detailFrom, detailTo)),
    [reports, detailQuery, detailStatus, detailFrom, detailTo],
  );
  const visibleComplaints = useMemo(
    () => complaints.filter((complaint) => matchesDetailFilters({ text: `${complaint.details} ${complaint.forwardedTo ?? ""}`, status: complaint.resolved ? "Resolved" : "Open", dateIso: isoDate(complaint.dateRaised) }, detailQuery, detailStatus, detailFrom, detailTo)),
    [complaints, detailQuery, detailStatus, detailFrom, detailTo],
  );
  const visibleUpsells = useMemo(
    () => upsells.filter((upsell) => matchesDetailFilters({ text: `${upsell.servicePitched} ${upsell.status} ${upsell.revenue}`, status: upsell.status, dateIso: isoDate(upsell.upsellDate) }, detailQuery, detailStatus, detailFrom, detailTo)),
    [upsells, detailQuery, detailStatus, detailFrom, detailTo],
  );
  const historyEntries = useMemo<ClientHistoryEntry[]>(
    () => history.map((entry) => ({
      id: entry._id ?? entry.id ?? `${entry.action}-${entry.recordType}-${entry.createdAt ?? ""}`,
      time: formatDate(entry.createdAt),
      dateIso: isoDate(entry.createdAt),
      actor: actorName(entry.actor),
      message: `${entry.action.replaceAll("_", " ").toLowerCase()} ${entry.recordType}`,
      tag: entry.recordType,
      recordId: entry.recordId,
      action: entry.action,
      source: entry.source,
      before: entry.before,
      after: entry.after,
    })),
    [history],
  );
  const visibleHistory = useMemo(
    () => historyEntries.filter((entry) => matchesDetailFilters({ text: `${entry.time} ${entry.actor} ${entry.message} ${entry.tag}`, dateIso: entry.dateIso }, detailQuery, "All", detailFrom, detailTo)),
    [historyEntries, detailQuery, detailFrom, detailTo],
  );
  const activeCstOwners = useMemo(
    () => teamUsers.filter((user) => (user._id ?? user.id) && user.active !== false && ["CST_MANAGER", "CST_HANDLER", "CST"].includes(user.role)),
    [teamUsers],
  );
  const cstManagers = useMemo(() => activeCstOwners.filter((user) => user.role === "CST_MANAGER"), [activeCstOwners]);
  const cstHandlers = useMemo(() => activeCstOwners.filter((user) => user.role === "CST_HANDLER" || user.role === "CST"), [activeCstOwners]);
  const selectedOwnerName = selectedCstOwner ? activeCstOwners.find((user) => (user._id ?? user.id) === selectedCstOwner)?.name ?? "Selected user" : "No change";

  if (loading || !client) {
    return <div className="state-card" data-testid="loading-state"><strong>Loading client</strong><p>Fetching from CRM…</p></div>;
  }

  const tabs = clientTabs;
  const statusOptions = detailStatusOptions[tab] ?? ["All"];
  const showFilters = tab !== "Overview";

  function clearDetailFilters() {
    setDetailQuery("");
    setDetailStatus("All");
    setDetailFrom("");
    setDetailTo("");
  }

  function changeTab(nextTab: string) {
    setTab(nextTab);
    setDetailQuery("");
    setDetailStatus("All");
    setDetailFrom("");
    setDetailTo("");
    setDetailFiltersOpen(false);
  }

  function openEditClient() {
    setSelectedCstOwner(client?.handlerId ?? "");
    setOwnerPickerOpen(false);
    setEditOpen(true);
  }

  function closeEditClient() {
    setOwnerPickerOpen(false);
    setEditOpen(false);
  }

  function chooseOwner(value: string) {
    setSelectedCstOwner(value);
    setOwnerPickerOpen(false);
  }

  function saveClient(formData: FormData) {
    if (!client) return;
    const payload: Record<string, unknown> = {};
    const fields: Array<{ key: string; formKey: string }> = [
      { key: "businessName", formKey: "businessName" },
      { key: "customerName", formKey: "customerName" },
      { key: "email", formKey: "email" },
      { key: "contactNumber", formKey: "phone" },
      { key: "mobileNumber", formKey: "mobile" },
      { key: "address", formKey: "businessAddress" },
      { key: "niche", formKey: "niche" },
      { key: "lifecycleStage", formKey: "stage" },
    ];
    for (const field of fields) {
      const value = String(formData.get(field.formKey) || "");
      if (value) payload[field.key] = value;
    }
    const cstHandler = String(formData.get("cstHandler") || "");
    if (canAssignCstOwner && cstHandler && cstHandler !== client.handlerId) payload.cstHandler = cstHandler;
    crmApi.update("clients", id, payload)
      .then(() => fetchClient())
      .catch(() => undefined)
      .finally(() => setEditOpen(false));
  }

  function saveActivity(formData: FormData) {
    if (!client) return;
    const activityType = String(formData.get("activityType") || "Contact");
    const dateIsoValue = String(formData.get("dateIso") || todayIso);
    const detail = String(formData.get("detail") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const channel = String(formData.get("channel") || "Phone");
    const nextReachBack = String(formData.get("nextReachBack") || dateIsoValue);
    const revenue = Number(formData.get("revenue") || 0);
    let request: Promise<unknown> | null = null;
    if (activityType === "Contact") request = crmApi.createContact({ client: client.id, contactDate: dateIsoValue, contactType: "Simple contact", channel, notes: notes || detail, nextReachBackDate: nextReachBack });
    if (activityType === "Report") request = crmApi.createReport({ client: client.id, category: "Retention", label: detail, periodMonth: dateIsoValue.slice(0, 7), dueDate: dateIsoValue, notes });
    if (activityType === "Complaint") request = crmApi.createComplaint({ client: client.id, dateRaised: dateIsoValue, details: detail || notes, forwardedTo: client.handler, resolved: false });
    if (activityType === "Upsell") request = crmApi.createUpsell({ client: client.id, servicePitched: detail, revenue, upsellDate: dateIsoValue, status: "In Progress" });
    request?.then(fetchClient).catch(() => undefined).finally(() => setLogOpen(false));
  }

  function closeAddModal() {
    setAddModal(null);
  }

  function saveClientService(formData: FormData) {
    if (!client) return;
    const service = String(formData.get("service") || "");
    if (!service) return;
    crmApi.createClientService(client.id, {
      service,
      monthlyAmount: Number(formData.get("monthlyAmount") || 0),
      billingType: String(formData.get("billingType") || "Recurring") as "Recurring" | "One Time",
      active: true,
    }).then(fetchClient).catch(() => undefined).finally(closeAddModal);
  }

  async function saveNewClientService(formData: FormData) {
    if (!client) return;
    const name = String(formData.get("serviceName") || "").trim();
    if (!name) return;
    try {
      const service = await crmApi.createService({ name });
      await crmApi.createClientService(client.id, {
        service: service._id,
        monthlyAmount: Number(formData.get("monthlyAmount") || 0),
        billingType: String(formData.get("billingType") || "Recurring") as "Recurring" | "One Time",
        active: true,
      });
      await fetchClient();
    } catch {
      // Existing API error handling is silent in this view.
    } finally {
      closeAddModal();
    }
  }

  function saveInvoice(formData: FormData) {
    if (!client) return;
    const paid = String(formData.get("paid") || "false") === "true";
    const sentDate = String(formData.get("sentDate") || "");
    const paidDate = String(formData.get("paidDate") || "");
    crmApi.createInvoice({
      client: client.id,
      billingMonth: String(formData.get("billingMonth") || monthValue(client.workStart)),
      amount: Number(formData.get("amount") || 0),
      issueDate: String(formData.get("issueDate") || todayIso),
      dueDate: String(formData.get("dueDate") || todayIso),
      sentDate: sentDate || (paid ? (paidDate || todayIso) : null),
      paid,
      paidDate: paid ? (paidDate || todayIso) : null,
    }).then(fetchClient).catch(() => undefined).finally(closeAddModal);
  }

  function saveContact(formData: FormData) {
    if (!client) return;
    const dateIsoValue = String(formData.get("contactDate") || todayIso);
    crmApi.createContact({
      client: client.id,
      contactDate: dateIsoValue,
      contactType: "Simple contact",
      channel: String(formData.get("channel") || "Phone"),
      notes: String(formData.get("notes") || ""),
      nextReachBackDate: String(formData.get("nextReachBackDate") || dateIsoValue),
    }).then(fetchClient).catch(() => undefined).finally(closeAddModal);
  }

  function saveReport(formData: FormData) {
    if (!client) return;
    const periodMonth = String(formData.get("periodMonth") || monthValue());
    const slot = String(formData.get("slot") || "15");
    crmApi.createReport({
      client: client.id,
      category: "Retention",
      label: slot === "30" ? "Retention Report 2 - 30 days" : "Retention Report 1 - 15 days",
      periodMonth,
      dueDate: monthDueDate(periodMonth, slot === "30" ? 30 : 15),
      notes: String(formData.get("notes") || ""),
    }).then(fetchClient).catch(() => undefined).finally(closeAddModal);
  }

  function saveComplaint(formData: FormData) {
    if (!client) return;
    const resolved = String(formData.get("resolved") || "false") === "true";
    crmApi.createComplaint({
      client: client.id,
      dateRaised: String(formData.get("dateRaised") || todayIso),
      details: String(formData.get("details") || ""),
      forwardedTo: String(formData.get("forwardedTo") || client.handler),
      resolved,
      dateResolved: resolved ? String(formData.get("dateResolved") || todayIso) : null,
    }).then(fetchClient).catch(() => undefined).finally(closeAddModal);
  }

  function saveUpsell(formData: FormData) {
    if (!client) return;
    crmApi.createUpsell({
      client: client.id,
      servicePitched: String(formData.get("servicePitched") || ""),
      revenue: Number(formData.get("revenue") || 0),
      upsellDate: String(formData.get("upsellDate") || todayIso),
      status: String(formData.get("status") || "In Progress"),
    }).then(fetchClient).catch(() => undefined).finally(closeAddModal);
  }

  return (
    <>
      <DetailHeader back="/clients" eyebrow="Client master record" title={client.businessName} subtitle={`${client.customerName} · ${client.id} · Started ${client.workStart}`} badge={<Badge tone={stageTone(client.stage)}>{client.stage}</Badge>}>
        <Button variant="secondary" onClick={() => setLogOpen(true)}><Plus size={15} />Log activity</Button>
        <Button onClick={openEditClient}><Pencil size={15} />Edit client</Button>
      </DetailHeader>

      <section className="detail-kpis">
        <div><span>Monthly recurring revenue</span><strong>${client.mrr.toLocaleString()}</strong><small>{client.services.length} active services</small></div>
        <div><span>Health score</span><strong>{client.health}%</strong><small>{client.health >= 80 ? "Healthy account" : "Needs attention"}</small></div>
        <div><span>Contacts logged</span><strong>{contacts.length}</strong><small>Backend contact records</small></div>
        <div><span>Open complaints</span><strong>{complaints.filter((item) => !item.resolved).length}</strong><small>{complaints.length} total records</small></div>
      </section>

      <TabBar tabs={tabs} active={tab} setActive={changeTab} />
      {showFilters && (
        <section className="panel detail-filter-panel">
          <div className="toolbar">
            <div className="toolbar-group">
              <SearchField value={detailQuery} onChange={setDetailQuery} placeholder={`Search ${tab.toLowerCase()}...`} />
              <Button variant="secondary" onClick={() => setDetailFiltersOpen((value) => !value)}><Filter size={15} />Filters</Button>
            </div>
            <div className="filter-tabs" aria-label={`${tab} status filter`}>
              {statusOptions.map((status) => <button key={status} className={detailStatus === status ? "active" : ""} onClick={() => setDetailStatus(status)}>{status}</button>)}
            </div>
          </div>
          {detailFiltersOpen && (
            <div className="operation-filters">
              {statusOptions.length > 1 && <Field label="Status"><select value={detailStatus} onChange={(event) => setDetailStatus(event.target.value)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></Field>}
              {tab !== "Services" && <><Field label="From"><input type="date" value={detailFrom} onChange={(event) => setDetailFrom(event.target.value)} /></Field><Field label="To"><input type="date" value={detailTo} onChange={(event) => setDetailTo(event.target.value)} /></Field></>}
              <Button variant="ghost" onClick={clearDetailFilters}>Clear filters</Button>
            </div>
          )}
        </section>
      )}

      {tab === "Overview" && (
        <div className="detail-grid">
          <section className="panel panel-pad detail-main">
            <div className="section-title"><div><h2>Account overview</h2><p>Primary identity, ownership, and lifecycle facts.</p></div></div>
            <dl className="detail-list">
              <div><dt>Primary contact</dt><dd><UserRound size={15} />{client.customerName}</dd></div>
              <div><dt>Email</dt><dd><Mail size={15} /><a href={`mailto:${client.email}`}>{client.email}</a></dd></div>
              <div><dt>Phone</dt><dd><Phone size={15} /><a href={`tel:${client.phone}`}>{client.phone}</a></dd></div>
              <div><dt>Mobile</dt><dd><Smartphone size={15} /><a href={`tel:${client.mobile || client.phone}`}>{client.mobile || "Not set"}</a></dd></div>
              <div><dt>Business address</dt><dd><MapPin size={15} />{client.businessAddress || "Not set"}</dd></div>
              <div><dt>NICHE</dt><dd><BriefcaseBusiness size={15} />{client.niche}</dd></div>
              <div><dt>CST handler</dt><dd><Avatar name={client.handler} tone="violet" />{client.handler}</dd></div>
              <div><dt>Lifecycle stage</dt><dd><Badge tone={stageTone(client.stage)}>{client.stage}</Badge></dd></div>
              <div><dt>Work start</dt><dd><CalendarClock size={15} />{client.workStart}</dd></div>
            </dl>
          </section>
          <aside className="panel detail-side">
            <div className="panel-head"><div><h2>Services</h2><p>Active services on this account</p></div></div>
            <div className="record-cards">{client.services.length ? client.services.map((service) => <article key={service}><div className="record-icon"><BriefcaseBusiness size={17} /></div><div><strong>{service}</strong><span>Active service</span></div><Badge tone="success">Active</Badge></article>) : <EmptyInline text="No linked services yet" />}</div>
          </aside>
        </div>
      )}

      {tab === "Services" && (
        <section className="panel"><div className="panel-head"><div><h2>Linked services</h2><p>Services this client has purchased.</p></div><div className="header-actions"><Button variant="secondary" onClick={() => setAddModal("service")}><Plus size={14} />Add service</Button><Button variant="ghost" onClick={() => setAddModal("newService")}><Plus size={14} />New service</Button></div></div>
          <div className="record-cards">{visibleServices.length ? visibleServices.map((service) => <article key={service}><div className="record-icon"><BriefcaseBusiness size={17} /></div><div><strong>{service}</strong><span>Active service on this account</span></div><Badge tone="success">Active</Badge></article>) : <EmptyInline text="No linked services found" />}</div>
        </section>
      )}

      {tab === "Invoices" && (
        <section className="panel"><div className="panel-head"><div><h2>Invoice history</h2><p>Permanent monthly amount snapshots.</p></div><div className="header-actions"><Button variant="secondary" onClick={() => setAddModal("invoice")}><Plus size={14} />Add invoice</Button><Link className="button secondary" href="/invoices">Full ledger</Link></div></div>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Month</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead><tbody>{visibleInvoices.map((invoice) => <tr key={invoice._id}><td><Link className="record-link" href={`/invoices/${invoice._id}`}>{invoice._id}</Link></td><td>{invoice.billingMonth}</td><td><strong>${invoice.amount.toLocaleString()}</strong></td><td>{formatDate(invoice.dueDate)}</td><td><Badge tone={statusTone(invoiceStatus(invoice))}>{invoiceStatus(invoice)}</Badge></td></tr>)}</tbody></table>{visibleInvoices.length === 0 && <EmptyInline text="No matching invoices" />}</div>
        </section>
      )}

      {tab === "Contacts" && (
        <section className="panel"><div className="panel-head"><div><h2>Contact log</h2><p>Date-based client touch history.</p></div><Button variant="secondary" onClick={() => setAddModal("contact")}><Plus size={14} />Log contact</Button></div>
          <div className="record-list">{visibleContacts.length ? visibleContacts.map((contact) => <article key={contact._id}><div className="record-icon"><Phone size={16} /></div><div><strong>{contact.channel}</strong><p>{contact.notes}</p><span>{formatDate(contact.contactDate)} - Next reach-back {formatDate(contact.nextReachBackDate)}</span></div><Badge tone="success">Resolved</Badge></article>) : <EmptyInline text="No matching contacts" />}</div>
        </section>
      )}

      {tab === "Reports" && (
        <section className="panel"><div className="panel-head"><div><h2>Scheduled reports</h2><p>Retention and onboarding deliverables by period.</p></div><Button variant="secondary" onClick={() => setAddModal("report")}><Plus size={14} />Add report</Button></div>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Report</th><th>Category</th><th>Period</th><th>Due</th><th>Status</th></tr></thead><tbody>{visibleReports.map((report) => <tr key={report._id}><td><strong>{report.label}</strong></td><td>{report.category}</td><td>{report.periodMonth}</td><td>{formatDate(report.dueDate)}</td><td><Badge tone={statusTone(report.status as Status)}>{report.status}</Badge></td></tr>)}</tbody></table>{visibleReports.length === 0 && <EmptyInline text="No matching reports" />}</div>
        </section>
      )}

      {tab === "Complaints" && (
        <section className="panel"><div className="panel-head"><div><h2>Complaints</h2><p>Issues from raised date through resolution.</p></div><Button variant="secondary" onClick={() => setAddModal("complaint")}><Plus size={14} />Log complaint</Button></div>
          <div className="record-list">{visibleComplaints.length ? visibleComplaints.map((complaint) => <article key={complaint._id}><div className="record-icon danger"><MessageSquareWarning size={16} /></div><div><strong>{complaint.details}</strong><p>Forwarded to {complaint.forwardedTo || client.handler}</p><span>Raised {formatDate(complaint.dateRaised)}{complaint.dateResolved ? ` - Resolved ${formatDate(complaint.dateResolved)}` : ""}</span></div><Badge tone={complaint.resolved ? "success" : "danger"}>{complaint.resolved ? "Resolved" : "Open"}</Badge></article>) : <EmptyInline text="No matching complaints" />}</div>
        </section>
      )}

      {tab === "Upsells" && (
        <section className="panel"><div className="panel-head"><div><h2>Upsell pipeline</h2><p>Expansion opportunities linked to this account.</p></div><Button variant="secondary" onClick={() => setAddModal("upsell")}><Plus size={14} />New opportunity</Button></div>
          <div className="record-cards">{visibleUpsells.length ? visibleUpsells.map((upsell) => <article key={upsell._id}><div className="record-icon"><HandCoins size={17} /></div><div><strong>{upsell.servicePitched}</strong><span>{formatDate(upsell.upsellDate)}</span></div><div className="record-value"><strong>${upsell.revenue.toLocaleString()}</strong><span>potential</span></div><Badge tone={statusTone(upsell.status as Status | "In Progress")}>{upsell.status}</Badge></article>) : <EmptyInline text="No matching upsells" />}</div>
        </section>
      )}

      {tab === "History" && (
        <section className="panel"><div className="panel-head"><div><h2>Audit history</h2><p>Client profile changes recorded by the system.</p></div></div>
          <div className="audit-list">{visibleHistory.length ? visibleHistory.map((entry) => <button type="button" className="audit-entry-button" key={entry.id} onClick={() => setSelectedHistory(entry)}><time>{entry.time || "No date"}</time><span><strong>{entry.actor}</strong> {entry.message}</span><code>{entry.tag}</code></button>) : <EmptyInline text="No matching history" />}</div>
        </section>
      )}

      <Modal open={editOpen} onClose={closeEditClient} title="Edit client" description="Update human-owned master record fields.">
        <form action={saveClient}>
          <div className="form-grid">
            <Field label="Business name"><input name="businessName" defaultValue={client.businessName} required /></Field>
            <Field label="Customer name"><input name="customerName" defaultValue={client.customerName} required /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={client.email} required /></Field>
            <Field label="Phone"><input name="phone" defaultValue={client.phone} required /></Field>
            <Field label="NICHE *"><input name="niche" defaultValue={client.niche} required /></Field>
            <Field label="Mobile"><input name="mobile" defaultValue={client.mobile || ""} placeholder="Mobile number" /></Field>
            <Field label="Business address"><textarea name="businessAddress" defaultValue={client.businessAddress || ""} placeholder="Street, city, state, ZIP" /></Field>
            <Field label="Lifecycle stage"><select name="stage" defaultValue={client.stage}><option>In Progress</option><option>Active</option><option>Not Active</option></select></Field>
            {canAssignCstOwner && (
              <Field label="CST Handler / Manager">
                <input type="hidden" name="cstHandler" value={selectedCstOwner} />
                <div className="owner-picker">
                  <button type="button" className="owner-picker-trigger" onClick={() => setOwnerPickerOpen((value) => !value)} aria-expanded={ownerPickerOpen}>
                    <span>{selectedOwnerName}</span><ChevronDown size={14} />
                  </button>
                  {ownerPickerOpen && (
                    <div className="owner-picker-menu">
                      <button type="button" className={`owner-picker-option ${!selectedCstOwner ? "active" : ""}`} onClick={() => chooseOwner("")}>No change</button>
                      {cstManagers.length > 0 && <div className="owner-picker-group">CST Managers</div>}
                      {cstManagers.map((user) => <button type="button" className={`owner-picker-option ${selectedCstOwner === (user._id ?? user.id) ? "active" : ""}`} key={user._id ?? user.id} onClick={() => chooseOwner(user._id ?? user.id ?? "")}>{user.name}</button>)}
                      {cstHandlers.length > 0 && <div className="owner-picker-group">CST Handlers</div>}
                      {cstHandlers.map((user) => <button type="button" className={`owner-picker-option ${selectedCstOwner === (user._id ?? user.id) ? "active" : ""}`} key={user._id ?? user.id} onClick={() => chooseOwner(user._id ?? user.id ?? "")}>{user.name}</button>)}
                    </div>
                  )}
                </div>
              </Field>
            )}
          </div>
          <div className="inline-form-actions"><Button type="button" variant="secondary" onClick={closeEditClient}>Cancel</Button><Button type="submit"><Check size={15} />Save changes</Button></div>
        </form>
      </Modal>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log client activity" description="Create a raw source record for engagement reporting." footer={<><Button variant="secondary" onClick={() => setLogOpen(false)}>Cancel</Button><Button type="submit" form="client-activity-form"><Check size={15} />Save activity</Button></>}>
        <form id="client-activity-form" className="form-grid" action={saveActivity}>
          <Field label="Activity type *"><select name="activityType" required><option>Contact</option><option>Report</option><option>Complaint</option><option>Upsell</option></select></Field>
          <Field label="Date"><input name="dateIso" type="date" defaultValue={todayIso} required /></Field>
          <Field label="Channel"><select name="channel" defaultValue="Phone"><option>Phone</option><option>Email</option><option>WhatsApp</option><option>Video</option></select></Field>
          <Field label="Record detail *"><input name="detail" defaultValue="Phone" placeholder="Channel, report label, issue, or service" required /></Field>
          <Field label="Next reach-back"><input name="nextReachBack" type="date" defaultValue={tomorrowIso} /></Field>
          <Field label="Revenue"><input name="revenue" type="number" min="0" defaultValue={0} /></Field>
          <div className="field full"><Field label="Notes"><textarea name="notes" placeholder="Add activity details..." /></Field></div>
        </form>
      </Modal>

      <Modal open={addModal === "service"} onClose={closeAddModal} title="Add service" description="Attach an active sold service to this client." footer={<><Button variant="secondary" onClick={closeAddModal}>Cancel</Button><Button type="submit" form="client-service-form"><Check size={15} />Save service</Button></>}>
        <form id="client-service-form" className="form-grid" action={saveClientService}>
          <Field label="Sold service *"><select name="service" required defaultValue=""><option value="" disabled>Select service</option>{serviceCatalog.map((service) => <option key={service._id} value={service._id}>{service.name}</option>)}</select></Field>
          <Field label="Amount"><input name="monthlyAmount" type="number" min="0" defaultValue={0} /></Field>
          <Field label="Billing type"><select name="billingType" defaultValue="Recurring"><option>Recurring</option><option>One Time</option></select></Field>
        </form>
      </Modal>

      <Modal open={addModal === "newService"} onClose={closeAddModal} title="New service" description="Create a service and attach it to this client." footer={<><Button variant="secondary" onClick={closeAddModal}>Cancel</Button><Button type="submit" form="client-new-service-form"><Check size={15} />Save service</Button></>}>
        <form id="client-new-service-form" className="form-grid" action={saveNewClientService}>
          <Field label="Service name *"><input name="serviceName" placeholder="Service name" required /></Field>
          <Field label="Amount"><input name="monthlyAmount" type="number" min="0" defaultValue={0} /></Field>
          <Field label="Billing type"><select name="billingType" defaultValue="Recurring"><option>Recurring</option><option>One Time</option></select></Field>
        </form>
      </Modal>

      <Modal open={addModal === "invoice"} onClose={closeAddModal} title="Add invoice" description="Create a backend invoice for this client." footer={<><Button variant="secondary" onClick={closeAddModal}>Cancel</Button><Button type="submit" form="client-invoice-form"><Check size={15} />Save invoice</Button></>}>
        <form id="client-invoice-form" className="form-grid" action={saveInvoice}>
          <Field label="Billing month"><input name="billingMonth" type="month" defaultValue={monthValue(client.workStart)} required /></Field>
          <Field label="Amount"><input name="amount" type="number" min="0" defaultValue={client.mrr} required /></Field>
          <Field label="Issue date"><input name="issueDate" type="date" defaultValue={todayIso} required /></Field>
          <Field label="Due date"><input name="dueDate" type="date" defaultValue={todayIso} required /></Field>
          <Field label="Sent date"><input name="sentDate" type="date" /></Field>
          <Field label="Paid"><select name="paid" defaultValue="false"><option value="false">No</option><option value="true">Yes</option></select></Field>
          <Field label="Paid date"><input name="paidDate" type="date" /></Field>
        </form>
      </Modal>

      <Modal open={addModal === "contact"} onClose={closeAddModal} title="Log contact" description="Save this touchpoint to the contacts module." footer={<><Button variant="secondary" onClick={closeAddModal}>Cancel</Button><Button type="submit" form="client-contact-form"><Check size={15} />Save contact</Button></>}>
        <form id="client-contact-form" className="form-grid" action={saveContact}>
          <Field label="Date"><input name="contactDate" type="date" defaultValue={todayIso} required /></Field>
          <Field label="Channel"><select name="channel" defaultValue="Phone"><option>Phone</option><option>WhatsApp</option><option>Email</option><option>Video</option></select></Field>
          <Field label="Next reach-back"><input name="nextReachBackDate" type="date" defaultValue={tomorrowIso} required /></Field>
          <div className="field full"><Field label="Notes *"><textarea name="notes" placeholder="Contact detail" required /></Field></div>
        </form>
      </Modal>

      <Modal open={addModal === "report"} onClose={closeAddModal} title="Add report" description="Each month has report 1 after 15 days and report 2 after 30 days." footer={<><Button variant="secondary" onClick={closeAddModal}>Cancel</Button><Button type="submit" form="client-report-form"><Check size={15} />Save report</Button></>}>
        <form id="client-report-form" className="form-grid" action={saveReport}>
          <Field label="Period month"><input name="periodMonth" type="month" defaultValue={monthValue()} required /></Field>
          <Field label="Report slot"><select name="slot" defaultValue="15"><option value="15">Report 1 - 15 days</option><option value="30">Report 2 - 30 days</option></select></Field>
          <div className="field full"><Field label="Comment"><textarea name="notes" placeholder="Report comment" /></Field></div>
        </form>
      </Modal>

      <Modal open={addModal === "complaint"} onClose={closeAddModal} title="Log complaint" description="Save this issue to the complaints module without leaving the client." footer={<><Button variant="secondary" onClick={closeAddModal}>Cancel</Button><Button type="submit" form="client-complaint-form"><Check size={15} />Save complaint</Button></>}>
        <form id="client-complaint-form" className="form-grid" action={saveComplaint}>
          <Field label="Raised date"><input name="dateRaised" type="date" defaultValue={todayIso} required /></Field>
          <Field label="Forwarded to"><input name="forwardedTo" defaultValue={client.handler} /></Field>
          <Field label="Resolved"><select name="resolved" defaultValue="false"><option value="false">No</option><option value="true">Yes</option></select></Field>
          <Field label="Resolved date"><input name="dateResolved" type="date" /></Field>
          <div className="field full"><Field label="Details *"><textarea name="details" placeholder="Complaint detail" required /></Field></div>
        </form>
      </Modal>

      <Modal open={addModal === "upsell"} onClose={closeAddModal} title="New upsell" description="Save this opportunity to the upsells module." footer={<><Button variant="secondary" onClick={closeAddModal}>Cancel</Button><Button type="submit" form="client-upsell-form"><Check size={15} />Save upsell</Button></>}>
        <form id="client-upsell-form" className="form-grid" action={saveUpsell}>
          <Field label="Service pitched *"><input name="servicePitched" placeholder="Service" required /></Field>
          <Field label="Revenue"><input name="revenue" type="number" min="0" defaultValue={0} /></Field>
          <Field label="Upsell date"><input name="upsellDate" type="date" defaultValue={todayIso} /></Field>
          <Field label="Status"><select name="status" defaultValue="In Progress"><option>In Progress</option><option>Converted</option><option>Lost</option></select></Field>
        </form>
      </Modal>

      <Modal open={Boolean(selectedHistory)} onClose={() => setSelectedHistory(null)} title="History details" description={selectedHistory ? `${selectedHistory.tag} ${selectedHistory.recordId ?? ""}` : undefined}>
        {selectedHistory && (
          <div className="history-detail">
            <dl className="detail-list">
              <div><dt>Action</dt><dd>{selectedHistory.action}</dd></div>
              <div><dt>Record</dt><dd>{selectedHistory.tag}</dd></div>
              <div><dt>Actor</dt><dd>{selectedHistory.actor}</dd></div>
              <div><dt>Date</dt><dd>{selectedHistory.time || "No date"}</dd></div>
              <div><dt>Source</dt><dd>{selectedHistory.source || "HUMAN"}</dd></div>
              <div><dt>Record ID</dt><dd>{selectedHistory.recordId || "N/A"}</dd></div>
            </dl>
            <div className="form-grid">
              <Field label="Before"><textarea readOnly value={prettyJson(selectedHistory.before)} /></Field>
              <Field label="After"><textarea readOnly value={prettyJson(selectedHistory.after)} /></Field>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export function InvoiceDetailView({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<{ id: string; client: { _id: string; businessName: string; customerName?: string; email?: string } | string; billingMonth: string; amount: number; dueDate: string; sentDate?: string | null; paid: boolean; paidDate?: string | null; status?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const fetchInvoice = useCallback(() => {
    setLoading(true);
    crmApi.invoices()
      .then((items) => {
        const found = items.find((i) => i.id === id);
        if (found) {
          setInvoice({
            id: found.id,
            client: found.client,
            billingMonth: found.month,
            amount: found.amount,
            dueDate: found.due,
            sentDate: found.sent || null,
            paid: found.paid,
            status: found.status,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { void Promise.resolve().then(fetchInvoice); }, [fetchInvoice]);

  if (loading || !invoice) {
    return <div className="state-card" data-testid="loading-state"><strong>Loading invoice</strong><p>Fetching from CRM…</p></div>;
  }

  const currentInvoice = invoice;
  const clientName = typeof currentInvoice.client === "object" ? currentInvoice.client.businessName : currentInvoice.client;

  function markSent() {
    crmApi.updateInvoice(currentInvoice.id, { sentDate: new Date().toISOString() })
      .then(fetchInvoice)
      .catch(() => undefined);
  }

  function markPaid() {
    crmApi.updateInvoice(currentInvoice.id, { paid: true, paidDate: new Date().toISOString() })
      .then(fetchInvoice)
      .catch(() => undefined);
  }

  return (
    <>
      <DetailHeader back="/invoices" eyebrow="Permanent financial ledger" title={invoice.id} subtitle={`${invoice.billingMonth} · Snapshot from invoice ledger`} badge={<Badge tone={statusTone((invoice.status as Status) ?? (invoice.paid ? "Paid" : "Not Sent"))}>{invoice.status ?? (invoice.paid ? "Paid" : "Not Sent")}</Badge>}>
        {!invoice.sentDate && <Button variant="secondary" onClick={markSent}><Send size={15} />Mark sent</Button>}
        {!invoice.paid && <Button onClick={markPaid}><CheckCircle2 size={15} />Mark paid</Button>}
        <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil size={15} />Edit facts</Button>
      </DetailHeader>
      <section className="detail-kpis">
        <div><span>Invoice amount</span><strong>${invoice.amount.toLocaleString()}</strong><small>Snapshot amount</small></div>
        <div><span>Amount paid</span><strong>${invoice.paid ? invoice.amount.toLocaleString() : "0"}</strong><small>{invoice.paid ? "Paid in full" : "Outstanding"}</small></div>
        <div><span>Due date</span><strong>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}</strong><small>{invoice.sentDate ? `Sent ${new Date(invoice.sentDate).toLocaleDateString()}` : "Not sent yet"}</small></div>
        <div><span>Client</span><strong>{clientName}</strong><small>Billed entity</small></div>
      </section>
      <div className="detail-grid">
        <section className="panel detail-main">
          <div className="invoice-document">
            <div className="invoice-brand"><div className="brand-mark">C</div><div><strong>CST CRM</strong><span>Workspace</span></div><div><small>INVOICE</small><strong>{invoice.id}</strong></div></div>
            <div className="invoice-parties">
              <div><span>Bill to</span><strong>{clientName}</strong></div>
              <dl><div><dt>Billing month</dt><dd>{invoice.billingMonth}</dd></div><div><dt>Due date</dt><dd>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"}</dd></div><div><dt>Payment status</dt><dd><Badge tone={statusTone((invoice.status as Status) ?? (invoice.paid ? "Paid" : "Not Sent"))}>{invoice.status ?? (invoice.paid ? "Paid" : "Not Sent")}</Badge></dd></div></dl>
            </div>
            <div className="invoice-total"><span>Total</span><strong>${invoice.amount.toLocaleString()}</strong></div>
            <div className="locked-note"><Clock3 size={15} /><span>This amount is a historical snapshot.</span></div>
          </div>
        </section>
      </div>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit invoice facts" description="Only sent and payment facts can change." footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => {
        const data = new FormData(document.getElementById("invoice-edit-form") as HTMLFormElement);
        const payload: Record<string, unknown> = {};
        if (data.get("sentDate")) payload.sentDate = new Date(String(data.get("sentDate"))).toISOString();
        if (data.get("paidDate")) payload.paidDate = new Date(String(data.get("paidDate"))).toISOString();
        if (data.get("paid") === "true") payload.paid = true;
        crmApi.updateInvoice(invoice.id, payload).then(fetchInvoice).catch(() => undefined);
        setEditOpen(false);
      }}><Check size={15} />Save facts</Button></>}>
        <form id="invoice-edit-form" className="form-grid"><Field label="Invoice amount" hint="Immutable monthly snapshot"><input value={`$${invoice.amount.toLocaleString()}`} readOnly /></Field><Field label="Due date"><input value={invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "—"} readOnly /></Field><Field label="Sent date"><input type="date" name="sentDate" defaultValue={invoice.sentDate ? new Date(invoice.sentDate).toISOString().slice(0, 10) : ""} /></Field><Field label="Paid"><select name="paid" defaultValue={invoice.paid ? "true" : "false"}><option value="false">Not paid</option><option value="true">Paid</option></select></Field><Field label="Paid date"><input type="date" name="paidDate" defaultValue={invoice.paidDate ? new Date(invoice.paidDate).toISOString().slice(0, 10) : ""} /></Field></form>
      </Modal>
    </>
  );
}

export function OnboardingDetailView({ id }: { id: string }) {
  const [record, setRecord] = useState<BackendOnboarding | null>(null);
  const [clientData, setClientData] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [client, onboarding] = await Promise.all([
        crmApi.client(id),
        crmApi.onboardingByClient(id).catch(() => null),
      ]);
      setClientData(client);
      if (onboarding) setRecord(onboarding);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void Promise.resolve().then(fetchData); }, [fetchData]);

  if (loading || !clientData) {
    return <div className="state-card" data-testid="loading-state"><strong>Loading onboarding</strong><p>Fetching from CRM…</p></div>;
  }

  const day = record?.productionGoAheadAt
    ? Math.min(30, Math.floor((now - new Date(record.productionGoAheadAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const status = record?.onboardStatus ?? "In Progress";
  const progress = Math.min(100, Math.round(day / 30 * 100));

  return (
    <>
      <DetailHeader back="/onboarding" eyebrow="0–30 day lifecycle" title={clientData.businessName} subtitle={`${clientData.customerName} · Day ${day} of 30 · ${clientData.handler}`} badge={<Badge tone={status === "Graduating this week" ? "success" : status === "Delayed" ? "danger" : "warning"}>{status}</Badge>}>
        <Link href={`/clients/${clientData.id}`} className="button secondary"><UserRound size={15} />Client record</Link>
        <Button onClick={() => setEditOpen(true)}><Pencil size={15} />Update onboarding</Button>
      </DetailHeader>
      {record?.delaySide && record.delaySide !== "N/A" && <section className={`alert-banner ${record.delaySide === "Our" ? "danger" : "warning"}`}><AlertTriangle size={18} /><div><strong>{record.delaySide}-side delay</strong><span>{record.delayReason || "No reason provided"}</span></div></section>}
      <section className="detail-kpis">
        <div><span>Onboarding progress</span><strong>{progress}%</strong><small>Day {day} of 30</small></div>
        <div><span>Status</span><strong>{status}</strong><small>{day >= 27 ? "Graduation imminent" : day >= 14 ? "Mid-point" : "Early stage"}</small></div>
        <div><span>Access status</span><strong>{record?.accessReceived ? "Received" : "Pending"}</strong><small>24-hour target</small></div>
        <div><span>Delay</span><strong>{record?.delaySide === "Our" ? "Our side" : record?.delaySide === "Client" ? "Client side" : "None"}</strong><small>{record?.highAlertSent ? "Alert sent" : "No alert"}</small></div>
      </section>
      <div className="detail-grid">
        <section className="panel detail-main">
          <div className="panel-head"><div><h2>Onboarding checklist</h2><p>Complete milestones through automatic Day-30 graduation.</p></div><span className="progress-label">{progress}% complete</span></div>
          <div className="milestone-progress"><i style={{ width: `${progress}%` }} /></div>
          <div className="checklist">
            {[
              { label: "Same-day welcome call", done: record?.calledSameDay ?? false, due: "Day 0" },
              { label: "Same-day welcome message", done: record?.welcomeMsgSameDay ?? false, due: "Day 0" },
              { label: "Account access received", done: record?.accessReceived ?? false, due: "Within 24h" },
              { label: "Production go-ahead received", done: !!record?.productionGoAheadAt, due: "Within 7 days" },
            ].map((item) => (
              <div key={item.label} className={item.done ? "done" : ""}>
                <span>{item.done ? <Check size={15} /> : null}</span>
                <div><strong>{item.label}</strong><small>{item.done ? "Completed" : "Pending"} · {item.due}</small></div>
                {item.done ? <Badge tone="success">Done</Badge> : <Badge tone="warning">Open</Badge>}
              </div>
            ))}
          </div>
          {record?.accessItems && record.accessItems.length > 0 && (
            <>
              <div className="panel-head"><div><h2>Access and assets</h2><p>Required items vary by sold service.</p></div></div>
              <div className="record-list compact">{record.accessItems.map((item: { label: string; required: boolean; received: boolean }) => <article key={item.label}><div className="record-icon"><BriefcaseBusiness size={15} /></div><div><strong>{item.label}</strong><span>{item.required ? "Required" : "Optional"}</span></div><Badge tone={item.received ? "success" : "warning"}>{item.received ? "Received" : "Pending"}</Badge></article>)}</div>
            </>
          )}
        </section>
      </div>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Update onboarding" description="Record delay ownership, escalation facts, and overall status." footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => setEditOpen(false)}><Check size={15} />Save update</Button></>}>
        <div className="form-grid">
          <Field label="Overall status"><select defaultValue={record?.onboardStatus ?? "In Progress"}><option>In Progress</option><option>Ready for review</option><option>Graduating this week</option><option>Delayed</option></select></Field>
          <Field label="Delay side"><select defaultValue={record?.delaySide ?? "N/A"}><option>N/A</option><option>Client</option><option>Our</option></select></Field>
          <Field label="Delay reason"><textarea defaultValue={record?.delayReason ?? ""} placeholder="Required when a delay is recorded" /></Field>
        </div>
      </Modal>
    </>
  );
}
