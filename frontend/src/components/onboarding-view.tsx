"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CalendarClock, ChevronRight, CircleCheck, Filter } from "lucide-react";
import { clients } from "@/lib/demo-data";
import { AddButton, Avatar, Badge, Button, Field, Modal, PageHeader } from "./ui";

const board = [
  { title: "In Progress", color: "var(--amber)", cards: [clients[1], clients[4], clients[8]] },
  { title: "Ready for review", color: "var(--primary)", cards: [clients[9], clients[10]] },
  { title: "Graduating this week", color: "var(--green)", cards: [clients[11]] },
];

export function OnboardingView() {
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [handler, setHandler] = useState("All");
  const filteredBoard = board.map((column) => ({ ...column, cards: column.cards.filter((client) => handler === "All" || client.handler === handler) }));
  return <>
    <PageHeader eyebrow="0–30 day lifecycle" title="Onboarding pipeline" description="Track access, milestones, delays, and automatic Day-30 graduation." action={<AddButton onClick={() => setOpen(true)} testId="add-onboarding">Add client</AddButton>} secondary={<Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}><Filter size={15} />Filter board</Button>} />
    <section className="mini-stats"><div className="mini-stat"><span>In progress</span><strong>6</strong></div><div className="mini-stat"><span>On track</span><strong>5</strong></div><div className="mini-stat"><span>Our-side delays</span><strong style={{ color: "var(--red)" }}>1</strong></div><div className="mini-stat"><span>Avg. completion</span><strong>73%</strong></div></section>
    {filtersOpen && <section className="panel operation-filters" style={{ marginBottom: 14 }}><Field label="CST handler"><select value={handler} onChange={(event) => setHandler(event.target.value)}><option>All</option><option>Arham</option><option>Hira</option><option>Sameer</option></select></Field><Button variant="ghost" onClick={() => setHandler("All")}>Clear filter</Button></section>}
    <section className="kanban" data-testid="onboarding-kanban">{filteredBoard.map((column) => <article className="kanban-column" key={column.title}><header className="kanban-head"><strong><i style={{ background: column.color }} />{column.title}</strong><span>{column.cards.length}</span></header>{column.cards.map((client, index) => <Link href={`/onboarding/${client.id}`} className="kanban-card kanban-card-link" key={client.id}><div><div><h3>{client.businessName}</h3><p>{client.customerName}</p></div><span className="table-action" aria-label={`Open onboarding for ${client.businessName}`}><ChevronRight size={16} /></span></div>{client.health < 60 && <div style={{ marginTop: 10 }}><Badge tone="danger"><AlertTriangle size={10} />Our-side delay</Badge></div>}<div className="kanban-meta"><span>Day {index * 7 + (column.title === "Graduating this week" ? 28 : 4)}</span><span>{client.handler}</span></div><div className="check-row"><span className="done" /><span className={index !== 2 ? "done" : ""} /><span className={column.title !== "In Progress" ? "done" : ""} /></div><footer><span><CalendarClock size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />Started {client.workStart.slice(5)}</span><Avatar name={client.handler} tone="violet" /></footer></Link>)}</article>)}</section>
    <Modal open={open} onClose={() => setOpen(false)} title="Start onboarding" description="The client will enter In Progress and receive a checklist." footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => setOpen(false)}><CircleCheck size={16} />Start onboarding</Button></>}><div className="form-grid"><Field label="Client"><select><option>Select a client</option><option>New paying client</option></select></Field><Field label="Work start"><input type="date" defaultValue="2026-06-20" /></Field><Field label="CST handler"><select><option>Arham</option><option>Hira</option><option>Sameer</option></select></Field><Field label="Initial status"><select><option>Access requested</option><option>Welcome sent</option></select></Field></div></Modal>
  </>;
}
