"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, ChevronRight,
  CircleDollarSign, Clock3, Download, FileText, HandCoins, MessageSquareWarning,
  PhoneCall, Users,
} from "lucide-react";
import type { ActivityRecord, DashboardData } from "@/lib/types";
import { getSession, roleLabel, type AuthUser } from "@/lib/auth";
import { Badge, Button, Field, Modal, PageHeader } from "./ui";

type DashboardViewProps = {
  data: DashboardData;
  activity: ActivityRecord[];
  initialFrom: string;
  initialTo: string;
};

const metricRoutes = ["/clients?stage=Active", "/clients?stage=Active", "/invoices?paid=false", "/analytics"] as const;
const metricIcons = [CircleDollarSign, Users, Banknote, Activity] as const;
const activityIcons = [PhoneCall, MessageSquareWarning, FileText, Clock3, HandCoins] as const;

function formatDateRange(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${formatter.format(new Date(`${from}T00:00:00`))} – ${formatter.format(new Date(`${to}T00:00:00`))}`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DashboardView({ data, activity, initialFrom, initialTo }: DashboardViewProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [appliedFrom, setAppliedFrom] = useState(initialFrom);
  const [appliedTo, setAppliedTo] = useState(initialTo);
  const [revenueView, setRevenueView] = useState<"total" | "paid" | "outstanding">("total");

  const revenue = useMemo(() => data.revenue.map((point) => ({
    ...point,
    displayValue: revenueView === "paid" ? Math.round(point.value * 0.78) : revenueView === "outstanding" ? Math.round(point.value * 0.22) : point.value,
  })), [data.revenue, revenueView]);
  const revenueTotal = revenue.reduce((sum, point) => sum + point.displayValue, 0);
  const revenueLabel = revenueView === "paid" ? "Paid revenue" : revenueView === "outstanding" ? "Outstanding" : "Total invoiced";

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentUser(getSession()?.user ?? null), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function applyDateRange() {
    if (!from || !to || from > to) return;
    setAppliedFrom(from);
    setAppliedTo(to);
    setDateOpen(false);
    router.replace(`/dashboard?from=${from}&to=${to}`, { scroll: false });
  }

  function exportDashboard() {
    downloadCsv(`cst-dashboard-${appliedFrom}-${appliedTo}.csv`, [
      ["CST CRM dashboard", formatDateRange(appliedFrom, appliedTo)],
      ["Metric", "Value", "Change"],
      ...data.metrics.map((metric) => [metric.label, metric.value, metric.change]),
      [],
      ["Revenue month", revenueLabel],
      ...revenue.map((point) => [point.month, point.displayValue]),
      [],
      ["Performance component", "Score", "Weight"],
      ...data.score.map((item) => [item.label, item.value, item.weight]),
    ]);
  }

  return <>
    <PageHeader
      eyebrow={`${currentUser ? roleLabel(currentUser.role) : "CRM"} overview`}
      title={`Good morning, ${currentUser?.name.split(" ")[0] ?? "there"}`}
      description="Here’s what’s happening across your customer success operation."
      action={<Button onClick={() => setDateOpen(true)}><CalendarDays size={16} />{formatDateRange(appliedFrom, appliedTo)}</Button>}
      secondary={<Button variant="secondary" onClick={exportDashboard}><Download size={15} />Export report</Button>}
    />
    <section className="metrics-grid" data-testid="dashboard-metrics">
      {data.metrics.map((item, index) => {
        const Icon = metricIcons[index] ?? Activity;
        return <Link className="metric-card hover-lift" href={metricRoutes[index] ?? "/analytics"} key={item.label}>
          <div className={`metric-icon ${item.tone}`}><Icon size={16} /></div>
          <div className="metric-top"><span>{item.label}</span><ChevronRight size={16} /></div>
          <strong>{item.value}</strong>
          <small className={item.tone}>
            {item.tone === "good" ? <ArrowUpRight size={14} /> : item.tone === "warn" ? <ArrowDownRight size={14} /> : null}{item.change}
          </small>
        </Link>;
      })}
    </section>
    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-head"><div><h2>Revenue trend</h2><p>Invoice ledger · selected period</p></div><select aria-label="Revenue view" value={revenueView} onChange={(event) => setRevenueView(event.target.value as typeof revenueView)}><option value="total">Total revenue</option><option value="paid">Paid revenue</option><option value="outstanding">Outstanding</option></select></div>
        <div className="chart-area"><div className="chart-bars">{revenue.map((point) => <div className="chart-column" key={point.month}><div style={{ height: `${Math.max(10, point.displayValue * 4.4)}px` }} title={`$${point.displayValue}K`} /><span>{point.month}</span></div>)}</div><div className="chart-legend"><div><span>{revenueLabel}</span><strong>${revenueTotal}K</strong></div><Link className="badge success" href="/analytics"><i />Open analytics</Link></div></div>
      </article>
      <article className="panel">
        <div className="panel-head"><div><h2>CST Performance</h2><p>Weighted score · selected period</p></div><Link href="/analytics"><Badge tone="violet">{data.metrics[3]?.change ?? "Review"}</Badge></Link></div>
        <div className="score-ring"><div><strong>{data.metrics[3]?.value ?? "0"}</strong><span>out of 100</span></div></div>
        <div className="score-list">{data.score.map((item) => <div className="score-row" key={item.label}><span>{item.label} · {item.weight}%</span><strong>{item.value}%</strong><div className="progress"><i style={{ width: `${item.value}%` }} /></div></div>)}</div>
      </article>
    </section>
    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-head"><div><h2>Action center</h2><p>Items that need attention this week</p></div><Link className="button ghost" href="/invoices?status=Late">View all</Link></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Priority</th><th>Task</th><th>Client</th><th>Due</th><th>Status</th></tr></thead><tbody>
          {activity.length ? activity.slice(0, 5).map((item) => {
            const href = item.kind === "Complaint" ? "/complaints" : item.kind === "Report" ? "/reports" : item.kind === "Upsell" ? "/upsells" : item.kind === "Invoice" ? "/invoices" : "/contacts";
            const urgent = item.status === "Late" || item.status === "In Progress";
            return <tr key={item.id}><td><Badge tone={urgent ? "danger" : "info"}>{urgent ? "High" : "Normal"}</Badge></td><td><Link href={href}><strong>{item.detail}</strong></Link></td><td>{item.client}</td><td>{item.date}</td><td><Badge tone={urgent ? "warning" : "success"}>{item.status}</Badge></td></tr>;
          }) : <tr><td colSpan={5}>No action items found for your role.</td></tr>}
        </tbody></table></div>
      </article>
      <article className="panel">
        <div className="panel-head"><div><h2>Recent activity</h2><p>Live across all clients</p></div><Link className="button ghost" href="/analytics">View all</Link></div>
        <div className="activity-list">{activity.map((item, index) => {
          const Icon = activityIcons[index] || Activity;
          const href = item.kind === "Complaint" ? "/complaints" : item.kind === "Report" ? "/reports" : item.kind === "Upsell" ? "/upsells" : item.kind === "Onboarding" ? "/onboarding" : "/contacts";
          return <Link className="activity-item" href={href} key={item.id}><span className="activity-icon"><Icon size={15} /></span><div><strong>{item.detail}</strong><span>{item.client} · {item.owner}</span></div><time>{item.date}</time></Link>;
        })}</div>
      </article>
    </section>

    <Modal open={dateOpen} onClose={() => setDateOpen(false)} title="Dashboard date range" description="Period metrics use this range; snapshot metrics remain current." footer={<><Button variant="secondary" onClick={() => setDateOpen(false)}>Cancel</Button><Button onClick={applyDateRange} disabled={!from || !to || from > to}>Apply range</Button></>}>
      <div className="form-grid">
        <Field label="From"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
      </div>
    </Modal>
  </>;
}
