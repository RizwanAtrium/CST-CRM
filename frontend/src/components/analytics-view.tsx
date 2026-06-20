"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, CalendarDays, Download, TrendingUp, Users } from "lucide-react";
import { Badge, Button, Field, Modal, PageHeader } from "./ui";

const monthLabels = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const monthValues = [22, 25, 24, 30, 33, 38, 41, 46, 49, 55, 58, 66];

function exportAnalytics(from: string, to: string) {
  const rows = [["Month", "Revenue ($K)"], ...monthLabels.map((month, index) => [month, String(monthValues[index])])];
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
  const [from, setFrom] = useState("2025-07-01");
  const [to, setTo] = useState("2026-06-20");

  return <><PageHeader eyebrow="Revenue intelligence" title="Analytics" description="Computed trends from the permanent invoice ledger and raw operations." action={<Button onClick={() => exportAnalytics(from, to)}><Download size={15} />Export dashboard</Button>} secondary={<Button variant="secondary" onClick={() => setDateOpen(true)}><CalendarDays size={15} />{from} – {to}</Button>} />
    <section className="mini-stats"><div className="mini-stat"><span>Total revenue</span><strong>$166.4K</strong></div><div className="mini-stat"><span>Revenue growth</span><strong style={{ color: "var(--green)" }}>+18.7%</strong></div><div className="mini-stat"><span>Average MRR/client</span><strong>$3,546</strong></div><div className="mini-stat"><span>Retention rate</span><strong>91.4%</strong></div></section>
    <section className="analytics-layout"><article className="panel"><div className="panel-head"><div><h2>Portfolio revenue</h2><p>Monthly invoiced amount · $K</p></div><Badge tone="success"><ArrowUpRight size={11} />Growing</Badge></div><div className="chart-area"><div className="chart-bars">{monthValues.map((value, index) => <div className="chart-column" key={monthLabels[index]}><div style={{ height: `${value * 2.45}px` }} /><span>{monthLabels[index]}</span></div>)}</div><div className="chart-legend"><div><span>6-month revenue</span><strong>$166.4K</strong></div><TrendingUp size={21} color="var(--green)" /></div></div></article>
      <article className="panel"><div className="panel-head"><div><h2>Client lifecycle</h2><p>Current portfolio distribution</p></div><Link href="/clients"><Users size={17} color="var(--muted)" /></Link></div><div className="donut-row"><div className="donut" /><div className="legend-list"><Link style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 9.5 }} href="/clients?stage=Active"><i /><span>Active</span><strong>47</strong></Link><Link style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 9.5 }} href="/clients?stage=In%20Progress"><i style={{ background: "var(--green)" }} /><span>In Progress</span><strong>6</strong></Link><Link style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 9.5 }} href="/clients"><i style={{ background: "var(--amber)" }} /><span>4+ months</span><strong>31</strong></Link><Link style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", fontSize: 9.5 }} href="/clients?stage=Not%20Active"><i style={{ background: "var(--red)" }} /><span>Churned</span><strong>8</strong></Link></div></div></article>
      <article className="panel"><div className="panel-head"><div><h2>Operational health</h2><p>KPI comparison</p></div><Badge tone="violet">86.4 score</Badge></div><div className="score-list" style={{ paddingTop: 19 }}>{[["Invoice timing",92],["Client contact",84],["Retention reports",88],["Complaint resolution",79],["4+ month retention",91]].map(([label,value]) => <div className="score-row" key={label}><span>{label}</span><strong>{value}%</strong><div className="progress"><i style={{ width: `${value}%` }} /></div></div>)}</div></article>
      <article className="panel"><div className="panel-head"><div><h2>Revenue by service</h2><p>Active line items only</p></div><Link className="button ghost" href="/services">View catalog</Link></div><div className="activity-list">{[["SEO","$28.4K","74%"],["Google Ads","$20.8K","58%"],["Website","$16.2K","45%"],["Social Media","$13.9K","39%"],["Video Editing","$8.6K","25%"]].map(([name,value,width]) => <Link href={`/services?search=${encodeURIComponent(name)}`} key={name} style={{ display: "block", padding: "11px 0" }}><div style={{ display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:7 }}><span>{name}</span><strong>{value}</strong></div><div className="progress"><i style={{ width }} /></div></Link>)}</div></article>
    </section>
    <Modal open={dateOpen} onClose={() => setDateOpen(false)} title="Analytics date range" footer={<><Button variant="secondary" onClick={() => setDateOpen(false)}>Cancel</Button><Button onClick={() => setDateOpen(false)} disabled={!from || !to || from > to}>Apply range</Button></>}>
      <div className="form-grid"><Field label="From"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="To"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field></div>
    </Modal>
  </>;
}
