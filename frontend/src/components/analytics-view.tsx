"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Download, Filter, TrendingUp, Users } from "lucide-react";
import { crmApi } from "@/lib/api";
import type { Client, DashboardData, Stage } from "@/lib/types";
import { Badge, Button, Field, Modal, PageHeader, SearchField } from "./ui";

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function exportAnalytics(from: string, to: string, data: DashboardData | null) {
  const rows = [
    ["Range", from, to],
    ["Metric", "Value"],
    ...(data?.metrics.map((metric) => [metric.label, metric.value]) ?? []),
    ["Month", "Revenue ($K)"],
    ...(data?.revenue.map((point) => [point.month, String(point.value)]) ?? []),
  ];
  const csv = rows.map((row) => row.join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `cst-analytics-${from}-${to}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsView() {
  const [dateOpen, setDateOpen] = useState(false);
  const [from, setFrom] = useState(isoDate(-30));
  const [to, setTo] = useState(isoDate());
  const [data, setData] = useState<DashboardData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<"All" | Stage>("All");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([crmApi.dashboard(), crmApi.clients()]).then(([dashboard, clientRows]) => {
      if (!cancelled) {
        setData(dashboard);
        setClients(clientRows);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const filteredClients = useMemo(() => clients.filter((client) => {
    const date = client.workStart ? new Date(client.workStart).toISOString().slice(0, 10) : "";
    return (stage === "All" || client.stage === stage)
      && (!from || !date || date >= from)
      && (!to || !date || date <= to)
      && `${client.businessName} ${client.customerName} ${client.handler} ${client.niche} ${client.services.join(" ")}`.toLowerCase().includes(query.toLowerCase());
  }), [clients, from, query, stage, to]);

  const lifecycle = useMemo(() => ({
    active: filteredClients.filter((client) => client.stage === "Active").length,
    inProgress: filteredClients.filter((client) => client.stage === "In Progress").length,
    churned: filteredClients.filter((client) => client.stage === "Not Active").length,
    total: filteredClients.length,
  }), [filteredClients]);

  const serviceRows = useMemo(() => {
    const counts = new Map<string, number>();
    filteredClients.forEach((client) => client.services.forEach((service) => counts.set(service, (counts.get(service) ?? 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredClients]);

  const nicheRows = useMemo(() => {
    const rows = new Map<string, { handler: string; niche: string; active: number; kept: number }>();
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    filteredClients.filter((client) => client.stage === "Active").forEach((client) => {
      const key = `${client.handler}-${client.niche}`;
      const current = rows.get(key) ?? { handler: client.handler, niche: client.niche, active: 0, kept: 0 };
      current.active += 1;
      if (client.workStart && new Date(client.workStart) <= fourMonthsAgo) current.kept += 1;
      rows.set(key, current);
    });
    return Array.from(rows.values()).sort((a, b) => b.active - a.active).slice(0, 6);
  }, [filteredClients]);

  function clearFilters() {
    setQuery("");
    setStage("All");
    setFrom(isoDate(-30));
    setTo(isoDate());
  }

  const revenue = data?.revenue ?? [];
  const totalRevenue = revenue.reduce((sum, point) => sum + point.value, 0);
  const growth = revenue.length > 1 && revenue[0].value ? ((revenue.at(-1)!.value - revenue[0].value) / revenue[0].value) * 100 : 0;
  const scoreMetric = data?.metrics.find((metric) => metric.label === "CST score");

  return <><PageHeader eyebrow="Revenue intelligence" title="Analytics" description="Computed trends from the permanent invoice ledger and raw operations." action={<Button onClick={() => exportAnalytics(from, to, data)}><Download size={15} />Export dashboard</Button>} secondary={<Button variant="secondary" onClick={() => setDateOpen(true)}><CalendarDays size={15} />{from} - {to}</Button>} />
    <section className="panel detail-filter-panel">
      <div className="toolbar"><div className="toolbar-group"><SearchField value={query} onChange={setQuery} placeholder="Search analytics..." /><Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}><Filter size={15} />Filters</Button></div><div className="filter-tabs">{(["All", "Active", "In Progress", "Not Active"] as const).map((value) => <button className={stage === value ? "active" : ""} key={value} onClick={() => setStage(value)}>{value}</button>)}</div></div>
      {filtersOpen && <div className="operation-filters"><Field label="Lifecycle stage"><select value={stage} onChange={(event) => setStage(event.target.value as "All" | Stage)}><option>All</option><option>Active</option><option>In Progress</option><option>Not Active</option></select></Field><Field label="From"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="To"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field><Button variant="ghost" onClick={clearFilters}>Clear filters</Button></div>}
    </section>
    <section className="mini-stats"><div className="mini-stat"><span>Total revenue</span><strong>${totalRevenue.toFixed(1)}K</strong></div><div className="mini-stat"><span>Revenue growth</span><strong style={{ color: "var(--green)" }}>{growth.toFixed(1)}%</strong></div><div className="mini-stat"><span>Active clients</span><strong>{lifecycle.active}</strong></div><div className="mini-stat"><span>CST score</span><strong>{scoreMetric?.value ?? "0"}</strong></div></section>
    <section className="analytics-layout"><article className="panel"><div className="panel-head"><div><h2>Portfolio revenue</h2><p>Monthly invoiced amount - $K</p></div><Badge tone="success"><ArrowUpRight size={11} />Live</Badge></div><div className="chart-area"><div className="chart-bars">{revenue.map((point) => <div className="chart-column" key={point.month}><div style={{ height: `${Math.max(10, point.value * 2.45)}px` }} /><span>{point.month}</span></div>)}</div><div className="chart-legend"><div><span>Visible revenue</span><strong>${totalRevenue.toFixed(1)}K</strong></div><TrendingUp size={21} color="var(--green)" /></div></div></article>
      <article className="panel"><div className="panel-head"><div><h2>Client lifecycle</h2><p>Current portfolio distribution</p></div><Link href="/clients"><Users size={17} color="var(--muted)" /></Link></div><div className="donut-row"><div className="donut" /><div className="legend-list"><Link style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 9.5 }} href="/clients?stage=Active"><i /><span>Active</span><strong>{lifecycle.active}</strong></Link><Link style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 9.5 }} href="/clients?stage=In%20Progress"><i style={{ background: "var(--green)" }} /><span>In Progress</span><strong>{lifecycle.inProgress}</strong></Link><Link style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 9.5 }} href="/clients"><i style={{ background: "var(--amber)" }} /><span>Total</span><strong>{lifecycle.total}</strong></Link><Link style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 9.5 }} href="/clients?stage=Not%20Active"><i style={{ background: "var(--red)" }} /><span>Churned</span><strong>{lifecycle.churned}</strong></Link></div></div></article>
      <article className="panel"><div className="panel-head"><div><h2>Operational health</h2><p>KPI comparison</p></div><Badge tone="violet">{scoreMetric?.value ?? "0"} score</Badge></div><div className="score-list" style={{ paddingTop: 19 }}>{data?.score.map((item) => <div className="score-row" key={item.label}><span>{item.label}</span><strong>{item.value}%</strong><div className="progress"><i style={{ width: `${item.value}%` }} /></div></div>) ?? <div>No KPI data found.</div>}</div></article>
      <article className="panel"><div className="panel-head"><div><h2>Services in portfolio</h2><p>Active line items only</p></div><Link className="button ghost" href="/services">View catalog</Link></div><div className="activity-list">{serviceRows.length ? serviceRows.map(([name, count]) => <Link href={`/services?search=${encodeURIComponent(name)}`} key={name} style={{ display: "block", padding: "11px 0" }}><div style={{ display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:7 }}><span>{name}</span><strong>{count}</strong></div><div className="progress"><i style={{ width: `${Math.min(100, count * 20)}%` }} /></div></Link>) : <div>No service data found.</div>}</div></article>
      <article className="panel"><div className="panel-head"><div><h2>Retention by niche</h2><p>Handler routing signal</p></div><Badge tone="info">Live</Badge></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Handler</th><th>Niche</th><th>Active</th><th>4+ months</th><th>Retention</th></tr></thead><tbody>{nicheRows.length ? nicheRows.map((row) => { const rate = row.active ? Math.round((row.kept / row.active) * 100) : 0; return <tr key={`${row.handler}-${row.niche}`}><td><strong>{row.handler}</strong></td><td>{row.niche}</td><td>{row.active}</td><td>{row.kept}</td><td><Badge tone={rate < 60 ? "warning" : "success"}>{rate}%</Badge></td></tr>; }) : <tr><td colSpan={5}>No niche data found.</td></tr>}</tbody></table></div></article>
    </section>
    <Modal open={dateOpen} onClose={() => setDateOpen(false)} title="Analytics date range" footer={<><Button variant="secondary" onClick={() => setDateOpen(false)}>Cancel</Button><Button onClick={() => setDateOpen(false)} disabled={!from || !to || from > to}>Apply range</Button></>}>
      <div className="form-grid"><Field label="From"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="To"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field></div>
    </Modal>
  </>;
}
