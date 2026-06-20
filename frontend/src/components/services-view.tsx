"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Check, Ellipsis, SlidersHorizontal, Trash2 } from "lucide-react";
import { clients, services as sourceServices } from "@/lib/demo-data";
import { AddButton, Badge, Button, Field, Modal, PageHeader, SearchField } from "./ui";

type ServiceItem = { id: string; name: string; active: boolean; basePrice: number };

const seededServices: ServiceItem[] = sourceServices.map((name, index) => ({ id: `SV-${index + 1}`, name, active: true, basePrice: [750, 450, 650, 700, 700, 1200, 900, 800, 1100, 850, 600, 950, 1300, 1400][index] }));

export function ServicesView({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<ServiceItem[]>(seededServices);
  const [modal, setModal] = useState<"add" | "usage" | "pricing" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("cst-crm-services");
      if (stored) setItems(JSON.parse(stored) as ServiceItem[]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const persist = (next: ServiceItem[]) => {
    setItems(next);
    window.localStorage.setItem("cst-crm-services", JSON.stringify(next));
  };
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const filtered = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const serviceClients = selected ? clients.filter((client) => client.services.includes(selected.name)) : [];
  const openService = (item: ServiceItem) => { setSelectedId(item.id); setPrice(item.basePrice); setModal("usage"); };
  const openPricing = (item?: ServiceItem) => {
    const target = item ?? selected ?? items[0];
    setSelectedId(target?.id ?? null);
    setPrice(target?.basePrice ?? 0);
    setModal("pricing");
  };
  const addService = () => {
    const trimmed = name.trim();
    if (!trimmed || items.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) return;
    persist([...items, { id: `SV-${Date.now()}`, name: trimmed, active: true, basePrice: price }]);
    setName(""); setPrice(0); setModal(null);
  };
  const savePrice = () => {
    if (!selected) return;
    persist(items.map((item) => item.id === selected.id ? { ...item, basePrice: Math.max(0, price) } : item));
    setModal("usage");
  };
  const toggle = (id: string) => persist(items.map((item) => item.id === id ? { ...item, active: !item.active } : item));
  const remove = () => {
    if (!selected || sourceServices.includes(selected.name)) return;
    persist(items.filter((item) => item.id !== selected.id));
    setModal(null);
  };

  return <><PageHeader eyebrow="Configurable catalog" title="Services" description="Source services used as client MRR line items." action={<AddButton onClick={() => { setName(""); setPrice(0); setModal("add"); }}>Add service</AddButton>} secondary={<Button variant="secondary" onClick={() => openPricing()}><SlidersHorizontal size={15} />Manage pricing</Button>} />
    <section className="toolbar panel" style={{ marginBottom: 14 }}><SearchField value={query} onChange={setQuery} placeholder="Search service catalog…" /><span style={{ color: "var(--muted)", fontSize: 10 }}>{items.filter((item) => item.active).length} active services</span></section>
    <section className="cards-grid" data-testid="services-grid">{filtered.map((item) => {
      const usage = clients.filter((client) => client.services.includes(item.name));
      return <article className="service-card hover-lift" key={item.id}><div className="service-card-head"><span className="service-icon"><BriefcaseBusiness size={18} /></span><button className="table-action" aria-label={`Service actions for ${item.name}`} onClick={() => openService(item)}><Ellipsis size={17} /></button></div><h3>{item.name}</h3><p>Recurring service available for client contracts and future invoice snapshots.</p><div className="service-price">${item.basePrice.toLocaleString()} <span>base monthly</span></div><footer><span>{usage.length} active clients</span><button aria-label={`Toggle ${item.name}`} aria-pressed={item.active} className={`toggle ${item.active ? "" : "off"}`} onClick={() => toggle(item.id)} /></footer></article>;
    })}</section>

    <Modal open={modal === "add"} onClose={() => setModal(null)} title="Add catalog service" description="New services become available as client line items." footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={addService}><Check size={14} />Add service</Button></>}>
      <div className="form-grid"><Field label="Service name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Service name" /></Field><Field label="Base monthly price"><input type="number" min="0" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></Field></div>
    </Modal>
    <Modal open={modal === "usage" && Boolean(selected)} onClose={() => setModal(null)} title={selected?.name ?? "Service usage"} description="Catalog status, pricing, and linked client usage." footer={<>{selected && !sourceServices.includes(selected.name) && <Button variant="danger" onClick={remove}><Trash2 size={14} />Delete</Button>}<Button variant="secondary" onClick={() => selected && toggle(selected.id)}>{selected?.active ? "Disable" : "Enable"}</Button><Button onClick={() => openPricing(selected ?? undefined)}>Edit price</Button></>}>
      {selected && <><div className="detail-list"><div><span>Status</span><Badge tone={selected.active ? "success" : "neutral"}>{selected.active ? "Active" : "Disabled"}</Badge></div><div><span>Base monthly price</span><strong>${selected.basePrice.toLocaleString()}</strong></div><div><span>Clients using service</span><strong>{serviceClients.length}</strong></div></div><div className="record-list compact">{serviceClients.length ? serviceClients.map((client) => <article key={client.id}><span className="record-icon"><BriefcaseBusiness size={15} /></span><div><strong>{client.businessName}</strong><p>{client.handler} · ${client.mrr.toLocaleString()} total MRR</p></div><Badge tone={client.stage === "Active" ? "success" : "warning"}>{client.stage}</Badge></article>) : <div className="inline-empty">No clients use this service</div>}</div></>}
    </Modal>
    <Modal open={modal === "pricing"} onClose={() => setModal(null)} title="Manage service pricing" description="Base pricing is a setup aid; client line-item amounts remain authoritative." footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={savePrice}>Save price</Button></>}>
      <div className="form-grid"><Field label="Service"><select value={selectedId ?? ""} onChange={(event) => { const item = items.find((row) => row.id === event.target.value); setSelectedId(event.target.value); setPrice(item?.basePrice ?? 0); }}>{items.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Field><Field label="Base monthly price"><input type="number" min="0" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></Field></div>
    </Modal>
  </>;
}
