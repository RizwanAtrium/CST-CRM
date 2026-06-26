"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft, Bell, Building2, Check, Database, Ellipsis, Eye, EyeOff, History, KeyRound,
  LockKeyhole, Play, ShieldCheck, UserCog, UserPlus, Users,
} from "lucide-react";
import { crmApi, type ApiAssignmentClient, type ApiJobRun, type ApiTeamUser, type ApiWorkspaceSettings } from "@/lib/api";
import { getSession, type UserRole } from "@/lib/auth";
import { Avatar, Badge, Button, Field, Modal, PageHeader } from "./ui";

type TeamRole = "Super Admin" | "Director" | "CST Manager" | "CST Handler";
type TeamMember = { id: string; name: string; email: string; role: TeamRole; active: boolean; lastActive: string };
type MemberDraft = TeamMember & { password: string; confirmPassword: string };
type AssignmentClient = { id: string; businessName: string; handlerId: string; handlerName: string };
type WorkspaceSettings = ApiWorkspaceSettings;
type JobRow = { id: string; job: string; status: "Success" | "Running" | "Failed"; finished: string; summary: string };

const emptySettings: WorkspaceSettings = { name: "", timezone: "", currency: "", weekStart: "", description: "", issueOffset: "", shortMonth: "", autoGeneration: "", delayAlerts: "", recipient: "", invoiceDigest: "", reportReminder: "" };

const roleToApi = (role: TeamRole) => ({ "Super Admin": "SUPER_ADMIN", Director: "DIRECTOR", "CST Manager": "CST_MANAGER", "CST Handler": "CST_HANDLER" } as const)[role];
const roleFromApi = (role: ApiTeamUser["role"] | "SUPER_ADMIN"): TeamRole => role === "SUPER_ADMIN" || role === "DIRECTOR" ? "Super Admin" : role === "CST_MANAGER" ? "CST Manager" : "CST Handler";
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

function normalizeJob(row: ApiJobRun): JobRow {
  const status = row.status === "SUCCESS" ? "Success" : row.status === "FAILED" ? "Failed" : "Running";
  const finishedAt = row.finishedAt ?? row.createdAt ?? row.startedAt ?? "";
  return {
    id: row._id ?? row.id ?? `${row.job}-${finishedAt}`,
    job: row.job,
    status,
    finished: finishedAt ? new Date(finishedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not finished",
    summary: row.error ?? (typeof row.summary === "string" ? row.summary : row.summary ? JSON.stringify(row.summary) : "No summary"),
  };
}

export function SettingsView({ initialTab = "Workspace" }: { initialTab?: string }) {
  const [tab, setTab] = useState(initialTab);
  const [settings, setSettings] = useState(emptySettings);
  const [saved, setSaved] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [assignmentClients, setAssignmentClients] = useState<AssignmentClient[]>([]);
  const [memberModal, setMemberModal] = useState<"invite" | "edit" | null>(null);
  const [member, setMember] = useState<MemberDraft>(emptyMember);
  const [memberError, setMemberError] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [showMemberPassword, setShowMemberPassword] = useState(false);
  const [showMemberConfirm, setShowMemberConfirm] = useState(false);
  const [fromHandler, setFromHandler] = useState("");
  const [toHandler, setToHandler] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [assignmentStatus, setAssignmentStatus] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);

  const isDirector = sessionRole === "SUPER_ADMIN" || sessionRole === "DIRECTOR";
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
      try {
        const [workspace, users, clients, jobRows] = await Promise.all([
          crmApi.workspaceSettings(),
          canManageHandlers ? crmApi.teamUsers() : Promise.resolve([]),
          canManageHandlers ? crmApi.assignmentClients() : Promise.resolve([]),
          isDirector ? crmApi.jobs() : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setSettings(workspace);
          const sessionUser = getSession()?.user;
          const nextTeam = canManageHandlers
            ? users.map(normalizeUser)
            : sessionUser ? [{ id: sessionUser.id, name: sessionUser.name, email: sessionUser.email, role: roleFromApi(sessionUser.role), active: true, lastActive: "Now" }] : [];
          setTeam(nextTeam);
          setAssignmentClients(clients.map((row) => normalizeClient(row, nextTeam)));
          const nextHandlers = nextTeam.filter((row) => row.role === "CST Handler" && row.active);
          setFromHandler(nextHandlers[0]?.id ?? "");
          setToHandler(nextHandlers[1]?.id ?? nextHandlers[0]?.id ?? "");
          setJobs(jobRows.map(normalizeJob));
        }
      } catch (error) {
        if (!cancelled) {
          setAssignmentStatus(error instanceof Error ? error.message : "Unable to load settings.");
        }
      }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [canManageHandlers, isDirector, sessionRole]);

  const update = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => { setSaved(false); setSettings((current) => ({ ...current, [key]: value })); };
  const saveSettings = async () => { setSettings(await crmApi.updateWorkspaceSettings(settings)); setSaved(true); };

  async function saveMember() {
    setMemberError("");
    if (!member.name.trim() || !member.email.trim()) return setMemberError("Name and email are required.");
    if (memberModal === "invite" && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/.test(member.password)) return setMemberError("Use 8+ characters with uppercase, lowercase, and a number.");
    if (member.password && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/.test(member.password)) return setMemberError("Use 8+ characters with uppercase, lowercase, and a number.");
    if (member.password && member.password !== member.confirmPassword) return setMemberError("Passwords do not match.");
    if (isManager && member.role !== "CST Handler") return setMemberError("CST Managers can only manage CST Handler accounts.");

    setSavingMember(true);
    try {
      const response = memberModal === "invite"
        ? await crmApi.createTeamUser({ name: member.name.trim(), email: member.email.trim(), password: member.password, role: roleToApi(member.role) })
        : await crmApi.updateTeamUser(member.id, { name: member.name.trim(), ...(isDirector ? { role: roleToApi(member.role) } : {}), active: member.active, ...(member.password ? { password: member.password } : {}) });
      const savedMember = normalizeUser(response);
      const next = memberModal === "invite" ? [...team, savedMember] : team.map((row) => row.id === member.id ? savedMember : row);
      setTeam(next);
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
    setShowMemberPassword(false);
    setShowMemberConfirm(false);
    setMemberModal("invite");
  }

  function openMember(row: TeamMember) {
    if (!isDirector && !(isManager && row.role === "CST Handler")) return;
    setMember({ ...row, password: "", confirmPassword: "" });
    setMemberError("");
    setShowMemberPassword(false);
    setShowMemberConfirm(false);
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
      await Promise.all(selectedClients.map((clientId) => crmApi.reassignClient(clientId, toHandler)));
      setAssignmentClients((current) => current.map((client) => selectedClients.includes(client.id) ? { ...client, handlerId: toHandler, handlerName: destination?.name ?? "CST Handler" } : client));
      setAssignmentStatus(`${selectedClients.length} client${selectedClients.length === 1 ? "" : "s"} reassigned to ${destination?.name}.`);
      setSelectedClients([]);
    } catch (error) {
      setAssignmentStatus(error instanceof Error ? error.message : "Client reassignment failed.");
    } finally {
      setTransferring(false);
    }
  }

  const runJobs = async () => {
    await crmApi.runJobs();
    setJobs((await crmApi.jobs()).map(normalizeJob));
  };
  const tabs = ["Workspace", "Team & roles", "Billing rules", "Notifications", "Audit & jobs"];
  const icons = [Building2, Users, Database, Bell, History];

  return <>
    <PageHeader eyebrow="Administration" title="Settings" description="Manage workspace preferences, users, roles, and system controls." action={<Button onClick={saveSettings}><Check size={15} />{saved ? "Saved" : "Save changes"}</Button>} />
    <div className="dashboard-grid settings-layout">
      <aside className="panel panel-pad settings-nav"><nav className="nav-list">{tabs.map((item, index) => { const Icon = icons[index]; return <button key={item} className={`nav-item ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}><Icon size={17} />{item}</button>; })}</nav></aside>
      <section className="panel settings-panel"><div className="panel-head"><div><h2>{tab}</h2><p>Configuration changes are recorded in the audit log.</p></div><Badge tone="success"><ShieldCheck size={11} />Protected</Badge></div><div className="panel-pad">
        {tab === "Workspace" && <div className="form-grid"><Field label="Workspace name"><input value={settings.name} onChange={(event) => update("name", event.target.value)} /></Field><Field label="Business timezone"><input value={settings.timezone} readOnly /></Field><Field label="Currency"><input value={settings.currency} readOnly /></Field><Field label="Week starts"><input value={settings.weekStart} readOnly /></Field><div className="field full"><Field label="Workspace description"><textarea value={settings.description} onChange={(event) => update("description", event.target.value)} /></Field></div></div>}
        {tab === "Team & roles" && <div className="team-settings">
          <div className="role-grid" aria-label="Role permissions">
            <article><span><ShieldCheck size={16} /></span><div><strong>Super Admin</strong><p>Full workspace, roles, billing, jobs, and every client.</p></div></article>
            <article><span><UserCog size={16} /></span><div><strong>CST Manager</strong><p>Add and manage handlers, then reassign clients between them.</p></div></article>
            <article><span><Users size={16} /></span><div><strong>CST Handler</strong><p>Work assigned clients and operational records only.</p></div></article>
          </div>
          <div className="settings-actions"><div><h3>Team accounts</h3><p>Every account signs in with its own email and password.</p></div>{canManageHandlers && <Button onClick={openInvite} data-testid="add-team-member"><UserPlus size={15} />Add team member</Button>}</div>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Team member</th><th>Role</th><th>Status</th><th>Last active</th><th /></tr></thead><tbody>{team.map((row) => { const manageable = isDirector || (isManager && row.role === "CST Handler"); return <tr key={row.id}><td><div className="cell-person"><Avatar name={row.name} tone="violet" /><div><strong>{row.name}</strong><span>{row.email}</span></div></div></td><td><Badge tone={row.role === "Super Admin" || row.role === "Director" ? "violet" : row.role === "CST Manager" ? "info" : "neutral"}>{row.role === "Director" ? "Super Admin" : row.role}</Badge></td><td><Badge tone={row.active ? "success" : "neutral"}>{row.active ? "Active" : "Disabled"}</Badge></td><td>{row.lastActive}</td><td>{manageable && <button className="table-action" onClick={() => openMember(row)} aria-label={`Manage ${row.name}`}><Ellipsis size={16} /></button>}</td></tr>; })}</tbody></table></div>
          <section className="assignment-card" data-testid="client-assignment">
            <div className="assignment-head"><div><span><ArrowRightLeft size={17} /></span><div><h3>Client assignment</h3><p>Move selected clients from one CST Handler to another.</p></div></div><Badge tone={canManageHandlers ? "success" : "neutral"}>{canManageHandlers ? "Manager access" : "View only"}</Badge></div>
            <div className="assignment-controls"><Field label="Current handler"><select value={fromHandler} onChange={(event) => { setFromHandler(event.target.value); setSelectedClients([]); setAssignmentStatus(""); }}>{handlers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><span className="assignment-arrow"><ArrowRightLeft size={16} /></span><Field label="New handler"><select value={toHandler} onChange={(event) => setToHandler(event.target.value)}>{handlers.filter((row) => row.id !== fromHandler).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field></div>
            <div className="assignment-list">{sourceClients.length ? sourceClients.map((client) => <label key={client.id}><input type="checkbox" checked={selectedClients.includes(client.id)} disabled={!canManageHandlers} onChange={() => toggleClient(client.id)} /><span><strong>{client.businessName}</strong><small>{client.id} · {client.handlerName}</small></span></label>) : <p>No clients assigned to this handler.</p>}</div>
            <div className="assignment-footer"><span className="status-message" role="status">{assignmentStatus || `${selectedClients.length} selected`}</span><Button onClick={transferClients} disabled={!canManageHandlers || transferring || !selectedClients.length || !toHandler || fromHandler === toHandler}>{transferring ? "Reassigning…" : "Reassign clients"}</Button></div>
          </section>
        </div>}
        {tab === "Billing rules" && <div className="form-grid"><Field label="Invoice issue offset"><select value={settings.issueOffset} onChange={(event) => update("issueOffset", event.target.value)}><option>7 days before due</option><option>5 days before due</option></select></Field><Field label="Early threshold"><input value={settings.issueOffset} readOnly /></Field><Field label="Short-month handling"><select value={settings.shortMonth} onChange={(event) => update("shortMonth", event.target.value)}><option>Use final calendar day</option><option>Carry to next month</option></select></Field><Field label="Auto-generation"><select value={settings.autoGeneration} onChange={(event) => update("autoGeneration", event.target.value)}><option>Enabled</option><option>Disabled</option></select></Field><div className="field full"><div className="demo-note"><KeyRound size={15} />Computed invoice timing and historical amounts cannot be edited by human users.</div></div></div>}
        {tab === "Notifications" && <div className="form-grid"><Field label="Our-side delay alerts"><input value={settings.delayAlerts} readOnly /></Field><Field label="Alert recipient"><input value={settings.recipient} onChange={(event) => update("recipient", event.target.value)} /></Field><Field label="Late invoice digest"><select value={settings.invoiceDigest} onChange={(event) => update("invoiceDigest", event.target.value)}><option>Every morning</option><option>Weekly</option></select></Field><Field label="Report reminders"><select value={settings.reportReminder} onChange={(event) => update("reportReminder", event.target.value)}><option>2 days before cutoff</option><option>1 day before cutoff</option></select></Field></div>}
        {tab === "Audit & jobs" && <div><div className="settings-actions"><div><h3>Scheduled jobs</h3><p>Manual runs are restricted to Super Admins.</p></div>{isDirector && <Button onClick={runJobs}><Play size={14} />Run jobs now</Button>}</div><div className="table-wrap"><table className="data-table"><thead><tr><th>Job</th><th>Status</th><th>Finished</th><th>Summary</th></tr></thead><tbody>{jobs.length ? jobs.map((job) => <tr key={job.id}><td><strong>{job.job}</strong></td><td><Badge tone={job.status === "Success" ? "success" : job.status === "Failed" ? "danger" : "warning"}>{job.status}</Badge></td><td>{job.finished}</td><td>{job.summary}</td></tr>) : <tr><td colSpan={4}>No job runs found.</td></tr>}</tbody></table></div></div>}
      </div></section>
    </div>

    <Modal open={memberModal !== null} onClose={() => setMemberModal(null)} title={memberModal === "invite" ? "Create team account" : "Manage team account"} description={isManager ? "CST Managers can create and manage Handler accounts." : "Set sign-in credentials and role access."} footer={<><Button variant="secondary" onClick={() => setMemberModal(null)}>Cancel</Button><Button onClick={saveMember} disabled={savingMember}>{savingMember ? "Saving…" : memberModal === "invite" ? "Create account" : "Save account"}</Button></>}>
      <div className="form-grid"><Field label="Full name"><input value={member.name} onChange={(event) => setMember((current) => ({ ...current, name: event.target.value }))} autoComplete="name" /></Field><Field label="Login email"><input type="email" value={member.email} disabled={memberModal === "edit"} onChange={(event) => setMember((current) => ({ ...current, email: event.target.value }))} autoComplete="email" /></Field><Field label="Role"><select value={member.role} disabled={isManager} onChange={(event) => setMember((current) => ({ ...current, role: event.target.value as TeamRole }))}>{isDirector && <option>Super Admin</option>}{isDirector && <option>CST Manager</option>}<option>CST Handler</option></select></Field><Field label="Account status"><select value={member.active ? "Active" : "Disabled"} onChange={(event) => setMember((current) => ({ ...current, active: event.target.value === "Active" }))}><option>Active</option><option>Disabled</option></select></Field><Field label={memberModal === "invite" ? "Login password" : "New password (optional)"} hint={memberModal === "edit" ? "Existing password is encrypted and cannot be shown. Enter a new one only to reset it." : "8+ characters with uppercase, lowercase, and a number."}><div className="input-with-icon password-field"><LockKeyhole size={15} /><input type={showMemberPassword ? "text" : "password"} value={member.password} minLength={8} maxLength={128} required={memberModal === "invite"} autoComplete="new-password" onChange={(event) => setMember((current) => ({ ...current, password: event.target.value }))} /><button type="button" className="password-toggle" onClick={() => setShowMemberPassword((value) => !value)} aria-label={showMemberPassword ? "Hide password" : "Show password"}>{showMemberPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></Field><Field label="Confirm password"><div className="input-with-icon password-field"><LockKeyhole size={15} /><input type={showMemberConfirm ? "text" : "password"} value={member.confirmPassword} minLength={8} maxLength={128} required={memberModal === "invite" || !!member.password} autoComplete="new-password" onChange={(event) => setMember((current) => ({ ...current, confirmPassword: event.target.value }))} /><button type="button" className="password-toggle" onClick={() => setShowMemberConfirm((value) => !value)} aria-label={showMemberConfirm ? "Hide password" : "Show password"}>{showMemberConfirm ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></Field></div>
      {memberError && <div className="form-error" role="alert">{memberError}</div>}
    </Modal>
  </>;
}
