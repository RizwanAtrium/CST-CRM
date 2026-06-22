"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
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
  getClientComplaints,
  getClientContacts,
  getClientInvoices,
  getClientReports,
  getClientUpsells,
  getDemoClient,
  getDemoInvoice,
  getOnboardingRecord,
} from "@/lib/demo-data";
import type { Stage, Status } from "@/lib/types";
import { Avatar, Badge, Button, Field, Modal } from "./ui";

const stageTone = (stage: Stage) => stage === "Active" ? "success" : stage === "In Progress" ? "warning" : "neutral";
const statusTone = (status: Status | "In Progress") => status === "Paid" || status === "Sent" || status === "Resolved" || status === "Converted" ? "success" : status === "Late" || status === "Open" ? "danger" : status === "Pending" || status === "In Progress" || status === "Not Sent" ? "warning" : "neutral";

type ClientHistoryEntry = {
  id: string;
  time: string;
  actor: string;
  message: string;
  tag: string;
};

const displayValue = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text || "Not set";
};

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
  const original = useMemo(() => getDemoClient(id), [id]);
  const [client, setClient] = useState(original);
  const [tab, setTab] = useState("Overview");
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const invoices = getClientInvoices(client);
  const contacts = getClientContacts(client);
  const reports = getClientReports(client);
  const complaints = getClientComplaints(client);
  const upsells = getClientUpsells(client);
  const [history, setHistory] = useState<ClientHistoryEntry[]>(() => [
    { id: "contact-created", time: "Today, 10:42", actor: original.handler, message: "logged a strategy contact", tag: "Contact created" },
    { id: "invoice-timing", time: "Jun 18, 14:05", actor: "System", message: "updated invoice timing", tag: "Sent → On time" },
    { id: "report-sent", time: "Jun 7, 09:12", actor: original.handler, message: `marked ${reports[0]?.label ?? "Report"} sent`, tag: "Pending → Sent" },
    { id: "client-created", time: original.workStart, actor: "Director", message: "created the client master record", tag: original.id },
  ]);
  const tabs = ["Overview", "Services", "Invoices", "Contacts", "Reports", "Complaints", "Upsells", "History"];

  function saveClient(formData: FormData) {
    const updatedClient = {
      ...client,
      businessName: String(formData.get("businessName") || client.businessName),
      customerName: String(formData.get("customerName") || client.customerName),
      email: String(formData.get("email") || client.email),
      phone: String(formData.get("phone") || client.phone),
      mobile: String(formData.get("mobile") || client.mobile || ""),
      businessAddress: String(formData.get("businessAddress") || client.businessAddress || ""),
      handler: String(formData.get("handler") || client.handler),
      stage: String(formData.get("stage") || client.stage) as Stage,
    };
    const fields: Array<{ key: keyof typeof updatedClient; label: string }> = [
      { key: "businessName", label: "Business name" },
      { key: "customerName", label: "Customer name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "mobile", label: "Mobile" },
      { key: "businessAddress", label: "Business address" },
      { key: "handler", label: "CST handler" },
      { key: "stage", label: "Lifecycle stage" },
    ];
    const changes = fields.filter(({ key }) => displayValue(client[key]) !== displayValue(updatedClient[key]));
    if (changes.length) {
      const now = new Date();
      const time = now.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      const actor = "Current user";
      setHistory((entries) => [
        ...changes.map(({ key, label }, index) => ({
          id: `client-edit-${now.getTime()}-${index}`,
          time,
          actor,
          message: `updated ${label}: ${displayValue(client[key])} → ${displayValue(updatedClient[key])}`,
          tag: "Client updated",
        })),
        ...entries,
      ]);
    }
    setClient(updatedClient);
    setEditOpen(false);
  }

  return (
    <>
      <DetailHeader back="/clients" eyebrow="Client master record" title={client.businessName} subtitle={`${client.customerName} · ${client.id} · Started ${client.workStart}`} badge={<Badge tone={stageTone(client.stage)}>{client.stage}</Badge>}>
        <Button variant="secondary" onClick={() => setLogOpen(true)}><Plus size={15} />Log activity</Button>
        <Button onClick={() => setEditOpen(true)}><Pencil size={15} />Edit client</Button>
      </DetailHeader>

      <section className="detail-kpis">
        <div><span>Monthly recurring revenue</span><strong>${client.mrr.toLocaleString()}</strong><small>{client.services.length} active services</small></div>
        <div><span>Health score</span><strong>{client.health}%</strong><small>{client.health >= 80 ? "Healthy account" : "Needs attention"}</small></div>
        <div><span>Contacts this week</span><strong>{contacts.length} / 3</strong><small>Weekly target {contacts.length >= 3 ? "met" : "open"}</small></div>
        <div><span>Open complaints</span><strong>{complaints.filter((item) => !item.resolved).length}</strong><small>{complaints.length} total records</small></div>
      </section>

      <TabBar tabs={tabs} active={tab} setActive={setTab} />

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
              <div><dt>CST handler</dt><dd><Avatar name={client.handler} tone="violet" />{client.handler}</dd></div>
              <div><dt>Lifecycle stage</dt><dd><Badge tone={stageTone(client.stage)}>{client.stage}</Badge></dd></div>
              <div><dt>Work start</dt><dd><CalendarClock size={15} />{client.workStart}</dd></div>
            </dl>
          </section>
          <aside className="panel detail-side">
            <div className="panel-head"><div><h2>Recent activity</h2><p>Latest account events</p></div></div>
            <div className="timeline">
              <div><i className="success"><Check size={12} /></i><span><strong>Strategy call completed</strong><small>Today · {client.handler}</small></span></div>
              <div><i><FileText size={12} /></i><span><strong>{reports[0].label} delivered</strong><small>Jun 7 · Report</small></span></div>
              <div><i><CreditCard size={12} /></i><span><strong>June invoice created</strong><small>Jun 1 · System</small></span></div>
              <div><i><BriefcaseBusiness size={12} /></i><span><strong>Service plan updated</strong><small>May 28 · Director</small></span></div>
            </div>
          </aside>
        </div>
      )}

      {tab === "Services" && <section className="panel"><div className="panel-head"><div><h2>Linked services</h2><p>Services this client has purchased. Customer-specific pricing is managed in the client profile and invoices, not on the service catalog.</p></div><Button variant="secondary" onClick={() => setEditOpen(true)}><Plus size={14} />Manage services</Button></div><div className="record-cards">{client.services.length ? client.services.map((service) => <article key={service}><div className="record-icon"><BriefcaseBusiness size={17} /></div><div><strong>{service}</strong><span>Active service on this account</span></div><Badge tone="success">Active</Badge></article>) : <EmptyInline text="No linked services yet" />}</div></section>}

      {tab === "Invoices" && <section className="panel"><div className="panel-head"><div><h2>Invoice history</h2><p>Permanent monthly amount snapshots.</p></div><Link className="button secondary" href="/invoices">Full ledger</Link></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Month</th><th>Amount</th><th>Due</th><th>Status</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><Link className="record-link" href={`/invoices/${invoice.id}`}>{invoice.id}</Link></td><td>{invoice.month}</td><td><strong>${invoice.amount.toLocaleString()}</strong></td><td>{invoice.due}</td><td><Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge></td></tr>)}</tbody></table></div></section>}

      {tab === "Contacts" && <section className="panel"><div className="panel-head"><div><h2>Contact log</h2><p>Date-based weekly touch history.</p></div><Button variant="secondary" onClick={() => setLogOpen(true)}><Plus size={14} />Log contact</Button></div><div className="record-list">{contacts.map((contact) => <article key={contact.id}><div className="record-icon"><Phone size={16} /></div><div><strong>{contact.channel}</strong><p>{contact.notes}</p><span>{contact.date} · {contact.owner}</span></div></article>)}</div></section>}

      {tab === "Reports" && <section className="panel"><div className="panel-head"><div><h2>Scheduled reports</h2><p>Retention and onboarding deliverables by period.</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Report</th><th>Category</th><th>Period</th><th>Date sent</th><th>Status</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td><strong>{report.label}</strong></td><td>{report.category}</td><td>{report.period}</td><td>{report.sent || "—"}</td><td><Badge tone={statusTone(report.status)}>{report.status}</Badge></td></tr>)}</tbody></table></div></section>}

      {tab === "Complaints" && <section className="panel"><div className="panel-head"><div><h2>Complaints</h2><p>Issues from raised date through resolution.</p></div><Link className="button secondary" href="/complaints"><Plus size={14} />Log complaint</Link></div>{complaints.length ? <div className="record-list">{complaints.map((complaint) => <article key={complaint.id}><div className="record-icon danger"><MessageSquareWarning size={16} /></div><div><strong>{complaint.detail}</strong><p>Forwarded to {complaint.forwardedTo}</p><span>Raised {complaint.raised}{complaint.resolvedDate ? ` · Resolved ${complaint.resolvedDate}` : ""}</span></div><Badge tone={complaint.resolved ? "success" : "danger"}>{complaint.resolved ? "Resolved" : "Open"}</Badge></article>)}</div> : <EmptyInline text="No complaints recorded for this client" />}</section>}

      {tab === "Upsells" && <section className="panel"><div className="panel-head"><div><h2>Upsell pipeline</h2><p>Expansion opportunities linked to this account.</p></div><Link className="button secondary" href="/upsells"><Plus size={14} />New opportunity</Link></div><div className="record-cards">{upsells.map((upsell) => <article key={upsell.id}><div className="record-icon"><HandCoins size={17} /></div><div><strong>{upsell.service}</strong><span>{upsell.date}</span></div><div className="record-value"><strong>${upsell.revenue.toLocaleString()}</strong><span>potential</span></div><Badge tone={statusTone(upsell.status)}>{upsell.status}</Badge></article>)}</div></section>}

      {tab === "History" && <section className="panel"><div className="panel-head"><div><h2>Audit history</h2><p>Every client profile edit and operational log is recorded here.</p></div></div><div className="audit-list">{history.map((entry) => <div key={entry.id}><time>{entry.time}</time><span><strong>{entry.actor}</strong> {entry.message}</span><code>{entry.tag}</code></div>)}</div></section>}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit client" description="Update human-owned master record fields. Computed totals remain locked.">
        <form action={saveClient}>
          <div className="form-grid">
            <Field label="Business name"><input name="businessName" defaultValue={client.businessName} required /></Field>
            <Field label="Customer name"><input name="customerName" defaultValue={client.customerName} required /></Field>
            <Field label="Email"><input name="email" type="email" defaultValue={client.email} required /></Field>
            <Field label="Phone"><input name="phone" defaultValue={client.phone} required /></Field>
            <Field label="Mobile"><input name="mobile" defaultValue={client.mobile || ""} placeholder="Mobile number" /></Field>
            <Field label="Business address"><textarea name="businessAddress" defaultValue={client.businessAddress || ""} placeholder="Street, city, state, ZIP" /></Field>
            <Field label="CST handler"><select name="handler" defaultValue={client.handler}><option>Arham</option><option>Hira</option><option>Sameer</option><option>Unassigned</option></select></Field>
            <Field label="Lifecycle stage"><select name="stage" defaultValue={client.stage}><option>In Progress</option><option>Active</option><option>Not Active</option></select></Field>
          </div>
          <div className="inline-form-actions"><Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit"><Check size={15} />Save changes</Button></div>
        </form>
      </Modal>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log client activity" description="Create a raw source record for engagement reporting." footer={<><Button variant="secondary" onClick={() => setLogOpen(false)}>Cancel</Button><Button onClick={() => setLogOpen(false)}><Check size={15} />Save activity</Button></>}>
        <div className="form-grid"><Field label="Activity type"><select><option>Contact</option><option>Complaint</option><option>Report</option><option>Upsell</option></select></Field><Field label="Date"><input type="date" defaultValue="2026-06-20" /></Field><Field label="Channel"><select><option>Video meeting</option><option>Phone</option><option>Email</option><option>WhatsApp</option></select></Field><Field label="Owner"><select defaultValue={client.handler}><option>Arham</option><option>Hira</option><option>Sameer</option></select></Field><Field label="Notes"><textarea placeholder="Add activity details…" /></Field></div>
      </Modal>
    </>
  );
}

export function InvoiceDetailView({ id }: { id: string }) {
  const initial = useMemo(() => getDemoInvoice(id), [id]);
  const [invoice, setInvoice] = useState(initial);
  const [editOpen, setEditOpen] = useState(false);
  const client = useMemo(() => {
    const found = ["CL-1001", "CL-1002", "CL-1003", "CL-1004", "CL-1005", "CL-1006", "CL-1007", "CL-1008"].map(getDemoClient).find((item) => item.businessName === invoice.client);
    return found ?? getDemoClient("CL-1001");
  }, [invoice.client]);
  const lineItems = client.services.length ? client.services : ["Monthly service plan"];
  const amountPerItem = lineItems.length ? invoice.amount / lineItems.length : invoice.amount;

  function markSent() {
    setInvoice({ ...invoice, sent: "Jun 20", status: "Sent" });
  }
  function markPaid() {
    setInvoice({ ...invoice, sent: invoice.sent || "Jun 20", status: "Paid", paid: true });
  }

  return (
    <>
      <DetailHeader back="/invoices" eyebrow="Permanent financial ledger" title={invoice.id} subtitle={`${invoice.month} · Snapshot created Jun 1, 2026`} badge={<Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge>}>
        {!invoice.sent && <Button variant="secondary" onClick={markSent}><Send size={15} />Mark sent</Button>}
        {!invoice.paid && <Button onClick={markPaid}><CheckCircle2 size={15} />Mark paid</Button>}
        <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil size={15} />Edit facts</Button>
      </DetailHeader>
      <section className="detail-kpis">
        <div><span>Invoice amount</span><strong>${invoice.amount.toLocaleString()}</strong><small>Immutable snapshot</small></div>
        <div><span>Amount paid</span><strong>${invoice.paid ? invoice.amount.toLocaleString() : "0"}</strong><small>{invoice.paid ? "Paid in full" : "Outstanding"}</small></div>
        <div><span>Due date</span><strong>{invoice.due}</strong><small>{invoice.sent ? `Sent ${invoice.sent}` : "Not sent yet"}</small></div>
        <div><span>Timing</span><strong>{invoice.sent ? (invoice.status === "Late" ? "Late" : "On time") : "Pending"}</strong><small>Computed from sent and due dates</small></div>
      </section>
      <div className="detail-grid">
        <section className="panel detail-main">
          <div className="invoice-document">
            <div className="invoice-brand"><div className="brand-mark">C</div><div><strong>CST CRM</strong><span>The Fine Dudes</span></div><div><small>INVOICE</small><strong>{invoice.id}</strong></div></div>
            <div className="invoice-parties">
              <div><span>Bill to</span><Link href={`/clients/${client.id}`}>{invoice.client}</Link><p>{client.customerName}<br />{client.email}</p></div>
              <dl><div><dt>Billing month</dt><dd>{invoice.month}</dd></div><div><dt>Due date</dt><dd>{invoice.due}</dd></div><div><dt>Payment status</dt><dd><Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge></dd></div></dl>
            </div>
            <div className="table-wrap"><table className="data-table invoice-lines"><thead><tr><th>Description</th><th>Period</th><th>Amount</th></tr></thead><tbody>{lineItems.map((item) => <tr key={item}><td><strong>{item}</strong><span>Monthly managed service</span></td><td>{invoice.month}</td><td><strong>${Math.round(amountPerItem).toLocaleString()}</strong></td></tr>)}</tbody></table></div>
            <div className="invoice-total"><span>Total</span><strong>${invoice.amount.toLocaleString()}</strong></div>
            <div className="locked-note"><Clock3 size={15} /><span>This amount is a historical snapshot. Future service-price changes will not rewrite it.</span></div>
          </div>
        </section>
        <aside className="panel detail-side">
          <div className="panel-head"><div><h2>Invoice activity</h2><p>Status and payment history</p></div></div>
          <div className="timeline">
            {invoice.paid && <div><i className="success"><Check size={12} /></i><span><strong>Payment recorded</strong><small>Jun 20 · CST user</small></span></div>}
            {invoice.sent && <div><i><Send size={12} /></i><span><strong>Invoice sent</strong><small>{invoice.sent} · {invoice.status === "Late" ? "After due date" : "Before due date"}</small></span></div>}
            <div><i><CreditCard size={12} /></i><span><strong>Invoice generated</strong><small>Jun 1 · Monthly billing job</small></span></div>
            <div><i><CircleDollarSign size={12} /></i><span><strong>MRR snapshot captured</strong><small>${invoice.amount.toLocaleString()}</small></span></div>
          </div>
          <div className="side-actions"><Link href={`/clients/${client.id}`} className="button secondary"><UserRound size={14} />Open client record</Link><Button variant="secondary" onClick={() => window.print()}><FileText size={14} />Print / save PDF</Button></div>
        </aside>
      </div>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit invoice facts" description="Only sent and payment facts can change. The amount and computed timing are locked." footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => setEditOpen(false)}><Check size={15} />Save facts</Button></>}>
        <div className="form-grid"><Field label="Invoice amount" hint="Immutable monthly snapshot"><input value={`$${invoice.amount.toLocaleString()}`} readOnly /></Field><Field label="Due date"><input value={invoice.due} readOnly /></Field><Field label="Sent date"><input type="date" defaultValue={invoice.sent ? "2026-06-20" : ""} /></Field><Field label="Paid date"><input type="date" defaultValue={invoice.paid ? "2026-06-20" : ""} /></Field></div>
      </Modal>
    </>
  );
}

export function OnboardingDetailView({ id }: { id: string }) {
  const client = useMemo(() => getDemoClient(id), [id]);
  const initial = useMemo(() => getOnboardingRecord(client), [client]);
  const [savedRecord, setSavedRecord] = useState(initial);
  const [record, setRecord] = useState(initial);
  const [editOpen, setEditOpen] = useState(false);
  const [checklistHistory, setChecklistHistory] = useState<ClientHistoryEntry[]>([]);
  const reports = getClientReports(client);
  const checklist = [
    { label: "Same-day welcome call", done: record.calledSameDay, due: "Day 0" },
    { label: "Same-day welcome message", done: record.welcomeSameDay, due: "Day 0" },
    { label: "Account access received", done: record.accessReceived, due: "Within 24h" },
    { label: "Week 1 report delivered", done: record.day >= 7, due: "Day 7" },
    { label: "Biweekly report delivered", done: record.day >= 14, due: "Day 14" },
    { label: "Monthly report and graduation", done: record.day >= 30, due: "Day 30" },
  ];
  const savedChecklist = [
    { label: "Same-day welcome call", done: savedRecord.calledSameDay },
    { label: "Same-day welcome message", done: savedRecord.welcomeSameDay },
    { label: "Account access received", done: savedRecord.accessReceived },
    { label: "Week 1 report delivered", done: savedRecord.day >= 7 },
    { label: "Biweekly report delivered", done: savedRecord.day >= 14 },
    { label: "Monthly report and graduation", done: savedRecord.day >= 30 },
  ];
  const progress = Math.round(checklist.filter((item) => item.done).length / checklist.length * 100);
  const hasChecklistChanges = checklist.some((item, index) => item.done !== savedChecklist[index]?.done);

  function toggleChecklist(index: number) {
    if (index === 0) setRecord({ ...record, calledSameDay: !record.calledSameDay });
    if (index === 1) setRecord({ ...record, welcomeSameDay: !record.welcomeSameDay });
    if (index === 2) setRecord({ ...record, accessReceived: !record.accessReceived });
  }

  function saveChecklistChanges() {
    const changes = checklist
      .map((item, index) => ({ label: item.label, before: savedChecklist[index]?.done ?? false, after: item.done }))
      .filter((change) => change.before !== change.after);

    if (!changes.length) return;

    const timestamp = new Date().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    setChecklistHistory((current) => [
      ...changes.map((change, index) => ({
        id: `${Date.now()}-${index}`,
        time: timestamp,
        actor: client.handler,
        message: `${change.after ? "Completed" : "Reopened"} onboarding milestone: ${change.label}`,
        tag: change.after ? "Completed" : "Reopened",
      })),
      ...current,
    ]);
    setSavedRecord(record);
  }

  function discardChecklistChanges() {
    setRecord(savedRecord);
  }

  return (
    <>
      <DetailHeader back="/onboarding" eyebrow="0–30 day lifecycle" title={client.businessName} subtitle={`${client.customerName} · Day ${record.day} of 30 · ${client.handler}`} badge={<Badge tone={record.delaySide === "Our" ? "danger" : record.status === "Graduating this week" ? "success" : "warning"}>{record.status}</Badge>}>
        <Link href={`/clients/${client.id}`} className="button secondary"><UserRound size={15} />Client record</Link>
        <Button onClick={() => setEditOpen(true)}><Pencil size={15} />Update onboarding</Button>
      </DetailHeader>
      {record.delaySide !== "N/A" && <section className={`alert-banner ${record.delaySide === "Our" ? "danger" : "warning"}`}><AlertTriangle size={18} /><div><strong>{record.delaySide}-side delay</strong><span>{record.delayReason}{record.highAlertSent ? " High alert sent to Asad." : ""}</span></div><Button variant="secondary" onClick={() => setRecord({ ...record, delaySide: "N/A", delayReason: "", flaggedToAsad: false })}>Resolve delay</Button></section>}
      <section className="detail-kpis">
        <div><span>Onboarding progress</span><strong>{progress}%</strong><small>{checklist.filter((item) => item.done).length} of {checklist.length} milestones</small></div>
        <div><span>Current day</span><strong>{record.day}</strong><small>Started {client.workStart}</small></div>
        <div><span>Access status</span><strong>{record.accessReceived ? "Received" : "Pending"}</strong><small>24-hour target</small></div>
        <div><span>Escalation</span><strong>{record.flaggedToAsad ? "Flagged" : "Clear"}</strong><small>{record.highAlertSent ? "Alert delivered" : "No high alert"}</small></div>
      </section>
      <div className="detail-grid">
        <section className="panel detail-main">
          <div className="panel-head"><div><h2>Onboarding checklist</h2><p>Complete milestones through automatic Day-30 graduation.</p></div><span className="progress-label">{progress}% complete</span></div>
          {hasChecklistChanges && <div className="alert-banner warning" style={{ margin: "0 0 14px" }}><AlertTriangle size={18} /><div><strong>Unsaved checklist changes</strong><span>Milestone clicks are temporary until Save changes is pressed. Nothing is written to History before saving.</span></div><div className="side-actions" style={{ marginTop: 0 }}><Button variant="secondary" onClick={discardChecklistChanges}>Discard</Button><Button onClick={saveChecklistChanges}><Check size={15} />Save changes</Button></div></div>}
          <div className="milestone-progress"><i style={{ width: `${progress}%` }} /></div>
          <div className="checklist">
            {checklist.map((item, index) => <button key={item.label} onClick={() => index < 3 && toggleChecklist(index)} className={item.done ? "done" : ""} disabled={index >= 3}><span>{item.done ? <Check size={15} /> : null}</span><div><strong>{item.label}</strong><small>{item.done ? "Completed" : "Pending"} · {item.due}</small></div>{item.done ? <Badge tone="success">Done</Badge> : <Badge tone={item.due === "Within 24h" && record.day > 1 ? "danger" : "warning"}>Open</Badge>}</button>)}
          </div>
        </section>
        <aside className="panel detail-side">
          <div className="panel-head"><div><h2>Scheduled reports</h2><p>Onboarding deliverables</p></div></div>
          <div className="record-list compact">{reports.map((report) => <article key={report.id}><div className="record-icon"><FileText size={15} /></div><div><strong>{report.label}</strong><span>{report.period}</span></div><Badge tone={statusTone(report.status)}>{report.status}</Badge></article>)}</div>
          <div className="panel-head"><div><h2>Ownership</h2><p>Assigned CST handler</p></div></div>
          <div className="owner-card"><Avatar name={client.handler} tone="violet" /><div><strong>{client.handler}</strong><span>Customer Success Team</span></div><Mail size={15} /></div>
        </aside>
      </div>
      <section className="panel onboarding-history"><div className="panel-head"><div><h2>Lifecycle history</h2><p>System and checklist activity</p></div></div><div className="audit-list">{checklistHistory.map((entry) => <div key={entry.id}><time>{entry.time}</time><span><strong>{entry.actor}</strong> {entry.message}</span><code>{entry.tag}</code></div>)}<div><time>Today</time><span><strong>{client.handler}</strong> reviewed onboarding progress</span><code>Day {savedRecord.day}</code></div>{savedRecord.highAlertSent && <div><time>Jun 19</time><span><strong>System</strong> sent a high alert to Asad</span><code>Our-side delay</code></div>}<div><time>{client.workStart}</time><span><strong>Director</strong> started onboarding</span><code>In Progress</code></div></div></section>
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Update onboarding" description="Record delay ownership, escalation facts, and overall status." footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={() => setEditOpen(false)}><Check size={15} />Save update</Button></>}>
        <div className="form-grid"><Field label="Overall status"><select defaultValue={record.status}><option>In Progress</option><option>Ready for review</option><option>Graduating this week</option></select></Field><Field label="Delay side"><select defaultValue={record.delaySide}><option>N/A</option><option>Client</option><option>Our</option></select></Field><Field label="Delay reason"><textarea defaultValue={record.delayReason} placeholder="Required when a delay is recorded" /></Field><Field label="Escalation"><select defaultValue={record.flaggedToAsad ? "Flagged to Asad" : "No escalation"}><option>No escalation</option><option>Flagged to Asad</option></select></Field></div>
      </Modal>
    </>
  );
}
