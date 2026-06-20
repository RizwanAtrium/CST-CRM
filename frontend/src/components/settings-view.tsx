"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft, Bell, Building2, Check, Database, Ellipsis, History, KeyRound,
  LockKeyhole, Play, ShieldCheck, UserCog, UserPlus, Users,
} from "lucide-react";
import { crmApi, type ApiAssignmentClient, type ApiTeamUser } from "@/lib/api";
import { getSession, type UserRole } from "@/lib/auth";
import { clients as demoClients } from "@/lib/demo-data";
import { Avatar, Badge, Button, Field, Modal, PageHeader } from "./ui";

type TeamRole = "Director" | "CST Manager" | "CST Handler";
type TeamMember = { id: string; name: string; email: string; role: TeamRole; active: boolean; lastActive: string };
type MemberDraft = TeamMember & { password: string; confirmPassword: string };
type AssignmentClient = { id: string; businessName: string; handlerId: string; handlerName: string };
type WorkspaceSettings = { name: string; timezone: string; currency: string; weekStart: string; description: string; issueOffset: string; shortMonth: string; autoGeneration: string; delayAlerts: string; recipient: string; invoiceDigest: string; reportReminder: string };
type JobRow = { id: string; job: string; status: "Success" | "Running" | "Failed"; finished: string; summary: string };

const initialSettings: WorkspaceSettings = { name: "The Fine Dudes", timezone: "Asia/Karachi", currency: "USD", weekStart: "Monday", description: "Customer success operations workspace", issueOffset: "5 days before due", shortMonth: "Use final calendar day", autoGeneration: "Enabled", delayAlerts: "In-app + email", recipient: "asad@thefinedudes.com", invoiceDigest: "Every morning", reportReminder: "2 days before cutoff" };
const initialTeam: TeamMember[] = [
  { id: "USR-1", name: "Asad Sheikh", email: "asad@thefinedudes.com", role: "Director", active: true, lastActive: "Now" },
  { id: "USR-2", name: "Arham Khan", email: "arham@thefinedudes.com", role: "CST Manager", active: true, lastActive: "4 min ago" },
  { id: "USR-3", name: "Hira Ali", email: "hira@thefinedudes.com", role: "CST Handler", active: true, lastActive: "12 min ago" },
  { id: "USR-4", name: "Sameer Raza", email: "sameer@thefinedudes.com", role: "CST Handler", active: true, lastActive: "1 hour ago" },
];
const initialJobs: JobRow[] = [
  { id: "JOB-1", job: "Invoice generation", status: "Success", finished: "Today, 03:00", summary: "4 created · 43 skipped" },
  { id: "JOB-2", job: "Onboarding milestones", status: "Success", finished: "Today, 03:05", summary: "2 reports · 1 graduated" },
  { id: "JOB-3", job: "Late status refresh", status: "Success", finished: "Today, 03:10", summary: "3 records updated" },
];

const roleToApi = (role: TeamRole) => ({ Director: "DIRECTOR", "CST Manager": "CST_MANAGER", "CST Handler": "CST_HANDLER" } as const)[role];
const roleFromApi = (role: ApiTeamUser["role"]): TeamRole => role === "DIRECTOR" ? "Director" : role === "CST_MANAGER" ? "CST Manager" : "CST Handler";
const emptyMember = (): MemberDraft => ({ id: "", name: "", email: "", role: "CST Handler", active: true, lastActive: "Not signed in", password: "", confirmPassword: "" });

function normalizeUser(row: ApiTeamUser): TeamMember {
  return {
    id: row._id ?? row.id ?? `USR-${Date.now()}`,
    name: row.name,
    email: row.email,
    role: roleFromApi(row.role),
    active: row.active ?? true,
    lastActive: row.lastActive ?? "Not signed in",
  };
}

function demoAssignments(team: TeamMember[]): AssignmentClient[] {
  return demoClients.map((client) => {
    const handler = team.find((row) => row.role === "CST Handler" && row.name.startsWith(client.handler));
    return { id: client.id, businessName: client.businessName, handlerId: handler?.id ?? "", handlerName: handler?.name ?? client.handler };
  });
}

function normalizeClient(row: ApiAssignmentClient, team: TeamMember[]): AssignmentClient {
  const handlerObject = typeof row.cstHandler === "object" && row.cstHandler ? row.cstHandler : null;
  const handlerId = typeof row.cstHandler === "string" ? row.cstHandler : handlerObject?._id ?? handlerObject?.id ?? "";
  const teamHandler = team.find((member) => member.id === handlerId);
  return {
    id: row._id ?? row.id ?? "",
    businessName: row.businessName,
    handlerId,
    handlerName: handlerObject?.name ?? teamHandler?.name ?? row.handler ?? "Unassigned",
  };
}

export function SettingsView({ initialTab = "Workspace" }: { initialTab?: string }) {
  const [tab, setTab] = useState(initialTab);
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(false);
  const [team, setTeam] = useState(initialTeam);
  const [assignmentClients, setAssignmentClients] = useState<AssignmentClient[]>(() => demoAssignments(initialTeam));
  const [memberModal, setMemberModal] = useState<"invite" | "edit" | null>(null);
  const [member, setMember] = useState<MemberDraft>(emptyMember);
  const [memberError, setMemberError] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [fromHandler, setFromHandler] = useState(initialTeam[2].id);
  const [toHandler, setToHandler] = useState(initialTeam[3].id);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [assignmentStatus, setAssignmentStatus] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [jobs, setJobs] = useState(initialJobs);
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);

  const isDirector = sessionRole === "DIRECTOR";
  const isManager = sessionRole === "CST_MANAGER";
  const canManageHandlers = isDirector || isManager;
  const handlers = useMemo(() => team.filter((row) => row.role === "CST Handler" && row.active), [team]);
  const sourceClients = useMemo(() => assignmentClients.filter((client) => client.handlerId === fromHandler), [assignmentClients, fromHandler]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSessionRole(getSession()?.user.role ?? "CST_HANDLER"), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (sessionRole === null) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let fallbackTeam = initialTeam;
      try {
        const storedSettings = window.localStorage.getItem("cst-crm-settings");
        const storedTeam = window.localStorage.getItem("cst-crm-team");
        if (storedSettings) setSettings(JSON.parse(storedSettings) as WorkspaceSettings);
        if (storedTeam) fallbackTeam = JSON.parse(storedTeam) as TeamMember[];
      } catch {
        window.localStorage.removeItem("cst-crm-settings");
        window.localStorage.removeItem("cst-crm-team");
      }
      if (!canManageHandlers) {
        const sessionUser = getSession()?.user;
        if (sessionUser && !cancelled) {
          setTeam([{ id: sessionUser.id, name: sessionUser.name, email: sessionUser.email, role: roleFromApi(sessionUser.role), active: true, lastActive: "Now" }]);
          setAssignmentClients([]);
        }
        return;
      }
      try {
        const users = await crmApi.teamUsers(fallbackTeam.map((row) => ({ ...row, role: roleToApi(row.role), id: row.id })));
        const nextTeam = users.map(normalizeUser);
        const fallbackClients = demoAssignments(nextTeam).map((row) => ({ id: row.id, businessName: row.businessName, cstHandler: row.handlerId, handler: row.handlerName }));
        const clients = await crmApi.assignmentClients(fallbackClients);
        if (!cancelled) {
          setTeam(nextTeam);
          setAssignmentClients(clients.map((row) => normalizeClient(row, nextTeam)));
          const nextHandlers = nextTeam.filter((row) => row.role === "CST Handler" && row.active);
          setFromHandler(nextHandlers[0]?.id ?? "");
          setToHandler(nextHandlers[1]?.id ?? nextHandlers[0]?.id ?? "");
        }
      } catch {
        if (!cancelled) {
          setTeam(fallbackTeam);
          setAssignmentClients(demoAssignments(fallbackTeam));
        }
      }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [canManageHandlers, sessionRole]);

  const update = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => { setSaved(false); setSettings((current) => ({ ...current, [key]: value })); };
  const saveSettings = () => { window.localStorage.setItem("cst-crm-settings", JSON.stringify(settings)); setSaved(true); };

  async function saveMember() {
    setMemberError("");
    if (!member.name.trim() || !member.email.trim()) return setMemberError("Name and email are required.");
    if (memberModal === "invite" && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/.test(member.password)) return setMemberError("Use 8+ characters with uppercase, lowercase, and a number.");
    if (member.password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/.test(member.password)) return setMemberError("Use 8+ characters with uppercase, lowercase, and a number.");
    if (member.password && member.password !== member.confirmPassword) return setMemberError("Passwords do not match.");
    if (isManager && member.role !== "CST Handler") return setMemberError("CST Managers can only manage CST Handler accounts.");

    setSavingMember(true);
    try {
      const fallback: ApiTeamUser = { id: member.id || `USR-${Date.now()}`, name: member.name.trim(), email: member.email.trim(), role: roleToApi(member.role), active: member.active, lastActive: member.lastActive };
      const response = memberModal === "invite"
        ? await crmApi.createTeamUser({ name: member.name.trim(), email: member.email.trim(), password: member.password, role: roleToApi(member.role) }, fallback)
        : await crmApi.updateTeamUser(member.id, { name: member.name.trim(), ...(isDirector ? { role: roleToApi(member.role) } : {}), active: member.active, ...(member.password ? { password: member.password } : {}) }, fallback);
      const savedMember = normalizeUser(response);
      const next = memberModal === "invite" ? [...team, savedMember] : team.map((row) => row.id === member.id ? savedMember : row);
      setTeam(next);
      window.localStorage.setItem("cst-crm-team", JSON.stringify(next));
      setMemberModal(null);
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : "Unable to save this account.");
    } finally {
      setSavingMember(false);
    }
  }

  function openInvite() {
    setMember({ ...emptyMember(), role: "CST Handler" });
    setMemberError("");
    setMemberModal("invite");
  }

  function openMember(row: TeamMember) {
    if (!isDirector && !(isManager && row.role === "CST Handler")) return;
    setMember({ ...row, password: "", confirmPassword: "" });
    setMemberError("");
    setMemberModal("edit");
  }

  function toggleClient(id: string) {
    setSelectedClients((current) => current.includes(id) ? current.filter((clientId) => clientId !== id) : [...current, id]);
  }

  async function transferClients() {
    if (!canManageHandlers || !selectedClients.length || !toHandler || fromHandler === toHandler) return;
    setTransferring(true);
    setAssignmentStatus("");
    const destination = handlers.find((row) => row.id === toHandler);
    try {
      await Promise.all(selectedClients.map((clientId) => {
        const client = assignmentClients.find((row) => row.id === clientId);
        return crmApi.reassignClient(clientId, toHandler, { id: clientId, businessName: client?.businessName ?? "Client", cstHandler: toHandler, handler: destination?.name });
      }));
      setAssignmentClients((current) => current.map((client) => selectedClients.includes(client.id) ? { ...client, handlerId: toHandler, handlerName: destination?.name ?? "CST Handler" } : client));
      setAssignmentStatus(`${selectedClients.length} client${selectedClients.length === 1 ? "" : "s"} reassigned to ${destination?.name}.`);
      setSelectedClients([]);
    } catch (error) {
      setAssignmentStatus(error instanceof Error ? error.message : "Client reassignment failed.");
    } finally {
      setTransferring(false);
    }
  }

  const runJobs = () => {
    const run: JobRow = { id: `JOB-${Date.now()}`, job: "All scheduled jobs", status: "Running", finished: "Running now", summary: "Started manually by Director" };
    setJobs((current) => [run, ...current]);
    window.setTimeout(() => setJobs((current) => current.map((row) => row.id === run.id ? { ...row, status: "Success", finished: "Just now", summary: "No duplicates · all jobs completed" } : row)), 700);
  };
  const tabs = ["Workspace", "Team & roles", "Billing rules", "Notifications", "Audit & jobs"];
  const icons = [Building2, Users, Database, Bell, History];

  return <>
    <PageHeader eyebrow="Administration" title="Settings" description="Manage workspace preferences, users, roles, and system controls." action={<Button onClick={saveSettings}><Check size={15} />{saved ? "Saved" : "Save changes"}</Button>} />
    <div className="dashboard-grid settings-layout">
      <aside className="panel panel-pad settings-nav"><nav className="nav-list">{tabs.map((item, index) => { const Icon = icons[index]; return <button key={item} className={`nav-item ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}><Icon size={17} />{item}</button>; })}</nav></aside>
      <section className="panel settings-panel"><div className="panel-head"><div><h2>{tab}</h2><p>Configuration changes are recorded in the audit log.</p></div><Badge tone="success"><ShieldCheck size={11} />Protected</Badge></div><div className="panel-pad">
        {tab === "Workspace" && <div className="form-grid"><Field label="Workspace name"><input value={settings.name} onChange={(event) => update("name", event.target.value)} /></Field><Field label="Business timezone"><select value={settings.timezone} onChange={(event) => update("timezone", event.target.value)}><option>Asia/Karachi</option><option>America/New_York</option><option>UTC</option></select></Field><Field label="Currency"><select value={settings.currency} onChange={(event) => update("currency", event.target.value)}><option>USD</option><option>PKR</option><option>GBP</option></select></Field><Field label="Week starts"><select value={settings.weekStart} onChange={(event) => update("weekStart", event.target.value)}><option>Monday</option><option>Sunday</option></select></Field><div className="field full"><Field label="Workspace description"><textarea value={settings.description} onChange={(event) => update("description", event.target.value)} /></Field></div></div>}
        {tab === "Team & roles" && <div className="team-settings">
          <div className="role-grid" aria-label="Role permissions">
            <article><span><ShieldCheck size={16} /></span><div><strong>Director</strong><p>Full workspace, roles, billing, jobs, and every client.</p></div></article>
            <article><span><UserCog size={16} /></span><div><strong>CST Manager</strong><p>Add and manage handlers, then reassign clients between them.</p></div></article>
            <article><span><Users size={16} /></span><div><strong>CST Handler</strong><p>Work assigned clients and operational records only.</p></div></article>
          </div>
          <div className="settings-actions"><div><h3>Team accounts</h3><p>Every account signs in with its own email and password.</p></div>{canManageHandlers && <Button onClick={openInvite} data-testid="add-team-member"><UserPlus size={15} />Add team member</Button>}</div>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Team member</th><th>Role</th><th>Status</th><th>Last active</th><th /></tr></thead><tbody>{team.map((row) => { const manageable = isDirector || (isManager && row.role === "CST Handler"); return <tr key={row.id}><td><div className="cell-person"><Avatar name={row.name} tone="violet" /><div><strong>{row.name}</strong><span>{row.email}</span></div></div></td><td><Badge tone={row.role === "Director" ? "violet" : row.role === "CST Manager" ? "info" : "neutral"}>{row.role}</Badge></td><td><Badge tone={row.active ? "success" : "neutral"}>{row.active ? "Active" : "Disabled"}</Badge></td><td>{row.lastActive}</td><td>{manageable && <button className="table-action" onClick={() => openMember(row)} aria-label={`Manage ${row.name}`}><Ellipsis size={16} /></button>}</td></tr>; })}</tbody></table></div>
          <section className="assignment-card" data-testid="client-assignment">
            <div className="assignment-head"><div><span><ArrowRightLeft size={17} /></span><div><h3>Client assignment</h3><p>Move selected clients from one CST Handler to another.</p></div></div><Badge tone={canManageHandlers ? "success" : "neutral"}>{canManageHandlers ? "Manager access" : "View only"}</Badge></div>
            <div className="assignment-controls"><Field label="Current handler"><select value={fromHandler} onChange={(event) => { setFromHandler(event.target.value); setSelectedClients([]); setAssignmentStatus(""); }}>{handlers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><span className="assignment-arrow"><ArrowRightLeft size={16} /></span><Field label="New handler"><select value={toHandler} onChange={(event) => setToHandler(event.target.value)}>{handlers.filter((row) => row.id !== fromHandler).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field></div>
            <div className="assignment-list">{sourceClients.length ? sourceClients.map((client) => <label key={client.id}><input type="checkbox" checked={selectedClients.includes(client.id)} disabled={!canManageHandlers} onChange={() => toggleClient(client.id)} /><span><strong>{client.businessName}</strong><small>{client.id} · {client.handlerName}</small></span></label>) : <p>No clients assigned to this handler.</p>}</div>
            <div className="assignment-footer"><span className="status-message" role="status">{assignmentStatus || `${selectedClients.length} selected`}</span><Button onClick={transferClients} disabled={!canManageHandlers || transferring || !selectedClients.length || !toHandler || fromHandler === toHandler}>{transferring ? "Reassigning…" : "Reassign clients"}</Button></div>
          </section>
        </div>}
        {tab === "Billing rules" && <div className="form-grid"><Field label="Invoice issue offset"><select value={settings.issueOffset} onChange={(event) => update("issueOffset", event.target.value)}><option>7 days before due</option><option>5 days before due</option></select></Field><Field label="Early threshold"><input value="5 days before due" readOnly /></Field><Field label="Short-month handling"><select value={settings.shortMonth} onChange={(event) => update("shortMonth", event.target.value)}><option>Use final calendar day</option><option>Carry to next month</option></select></Field><Field label="Auto-generation"><select value={settings.autoGeneration} onChange={(event) => update("autoGeneration", event.target.value)}><option>Enabled</option><option>Disabled</option></select></Field><div className="field full"><div className="demo-note"><KeyRound size={15} />Computed invoice timing and historical amounts cannot be edited by human users.</div></div></div>}
        {tab === "Notifications" && <div className="form-grid"><Field label="Our-side delay alerts"><select value={settings.delayAlerts} onChange={(event) => update("delayAlerts", event.target.value)}><option>In-app + email</option><option>In-app only</option></select></Field><Field label="Alert recipient"><input value={settings.recipient} onChange={(event) => update("recipient", event.target.value)} /></Field><Field label="Late invoice digest"><select value={settings.invoiceDigest} onChange={(event) => update("invoiceDigest", event.target.value)}><option>Every morning</option><option>Weekly</option></select></Field><Field label="Report reminders"><select value={settings.reportReminder} onChange={(event) => update("reportReminder", event.target.value)}><option>2 days before cutoff</option><option>1 day before cutoff</option></select></Field></div>}
        {tab === "Audit & jobs" && <div><div className="settings-actions"><div><h3>Scheduled jobs</h3><p>Manual runs are restricted to Directors.</p></div>{isDirector && <Button onClick={runJobs}><Play size={14} />Run jobs now</Button>}</div><div className="table-wrap"><table className="data-table"><thead><tr><th>Job</th><th>Status</th><th>Finished</th><th>Summary</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td><strong>{job.job}</strong></td><td><Badge tone={job.status === "Success" ? "success" : job.status === "Failed" ? "danger" : "warning"}>{job.status}</Badge></td><td>{job.finished}</td><td>{job.summary}</td></tr>)}</tbody></table></div><h3 className="settings-section-title">Recent audit activity</h3><div className="audit-list">{[["Asad Sheikh","Updated workspace billing rules","2 min ago"],["Arham Khan","Resolved complaint CP-1003-1","18 min ago"],["System","Generated June invoice ledger","Today, 03:00"],["Hira Ali","Converted Google Ads upsell","Yesterday"]].map(([actor,action,time]) => <div key={`${actor}-${action}`}><strong>{actor}</strong><span>{action}</span><code>{time}</code></div>)}</div></div>}
      </div></section>
    </div>

    <Modal open={memberModal !== null} onClose={() => setMemberModal(null)} title={memberModal === "invite" ? "Create team account" : "Manage team account"} description={isManager ? "CST Managers can create and manage Handler accounts." : "Set sign-in credentials and role access."} footer={<><Button variant="secondary" onClick={() => setMemberModal(null)}>Cancel</Button><Button onClick={saveMember} disabled={savingMember}>{savingMember ? "Saving…" : memberModal === "invite" ? "Create account" : "Save account"}</Button></>}>
      <div className="form-grid"><Field label="Full name"><input value={member.name} onChange={(event) => setMember((current) => ({ ...current, name: event.target.value }))} autoComplete="name" /></Field><Field label="Login email"><input type="email" value={member.email} disabled={memberModal === "edit"} onChange={(event) => setMember((current) => ({ ...current, email: event.target.value }))} autoComplete="email" /></Field><Field label="Role"><select value={member.role} disabled={isManager} onChange={(event) => setMember((current) => ({ ...current, role: event.target.value as TeamRole }))}>{isDirector && <option>Director</option>}{isDirector && <option>CST Manager</option>}<option>CST Handler</option></select></Field><Field label="Account status"><select value={member.active ? "Active" : "Disabled"} onChange={(event) => setMember((current) => ({ ...current, active: event.target.value === "Active" }))}><option>Active</option><option>Disabled</option></select></Field><Field label={memberModal === "invite" ? "Login password" : "New password (optional)"} hint="8+ characters with uppercase, lowercase, and a number. Never shown after saving."><div className="input-with-icon"><LockKeyhole size={15} /><input type="password" value={member.password} minLength={8} maxLength={128} required={memberModal === "invite"} autoComplete="new-password" onChange={(event) => setMember((current) => ({ ...current, password: event.target.value }))} /></div></Field><Field label="Confirm password"><div className="input-with-icon"><LockKeyhole size={15} /><input type="password" value={member.confirmPassword} minLength={8} maxLength={128} required={memberModal === "invite" || !!member.password} autoComplete="new-password" onChange={(event) => setMember((current) => ({ ...current, confirmPassword: event.target.value }))} /></div></Field></div>
      {memberError && <div className="form-error" role="alert">{memberError}</div>}
    </Modal>
  </>;
}
