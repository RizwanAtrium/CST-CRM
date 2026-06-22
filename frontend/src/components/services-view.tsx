"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Check } from "lucide-react";
import { services as sourceServices } from "@/lib/demo-data";
import { AddButton, Badge, Button, Field, Modal, PageHeader, SearchField } from "./ui";

type ServiceItem = { id: string; name: string; active: boolean; basePrice: number };

const seededServices: ServiceItem[] = sourceServices.map((name, index) => ({
  id: `SV-${index + 1}`,
  name,
  active: true,
  basePrice: [750, 450, 650, 700, 700, 1200, 900, 800, 1100, 850, 600, 950, 1300, 1400][index] ?? 0,
}));

export function ServicesView({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<ServiceItem[]>(seededServices);
  const [modal, setModal] = useState<"add" | null>(null);
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

  const filtered = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [items, query]);

  const addService = () => {
    const trimmed = name.trim();
    if (!trimmed || items.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) return;
    persist([...items, { id: `SV-${Date.now()}`, name: trimmed, active: true, basePrice: Math.max(0, price) }]);
    setName("");
    setPrice(0);
    setModal(null);
  };

  return <>
    <PageHeader
      eyebrow="Base catalog"
      title="Services"
      description="Internal list of services available while creating or editing client profiles. Customer-specific pricing is managed only inside each client profile."
      action={<AddButton onClick={() => { setName(""); setPrice(0); setModal("add"); }}>Add service</AddButton>}
    />
    <section className="toolbar panel" style={{ marginBottom: 14 }}>
      <SearchField value={query} onChange={setQuery} placeholder="Search service names…" />
      <span style={{ color: "var(--muted)", fontSize: 10 }}>{items.filter((item) => item.active).length} base services</span>
    </section>
    <section className="cards-grid" data-testid="services-grid">
      {filtered.map((item) => (
        <article className="service-card hover-lift" key={item.id}>
          <div className="service-card-head"><span className="service-icon"><BriefcaseBusiness size={18} /></span><Badge tone={item.active ? "success" : "neutral"}>{item.active ? "Available" : "Disabled"}</Badge></div>
          <h3>{item.name}</h3>
          <p>Available for client profiles, invoices, and upsell selections.</p>
          <div className="service-price">${item.basePrice.toLocaleString()} <span>base price</span></div>
          <footer><span>Client-specific pricing stays inside the client profile.</span></footer>
        </article>
      ))}
    </section>

    <Modal open={modal === "add"} onClose={() => setModal(null)} title="Add base service" description="This service will become selectable inside Add/Edit Client profile forms." footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={addService}><Check size={14} />Add service</Button></>}>
      <div className="form-grid">
        <Field label="Service name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Service name" /></Field>
        <Field label="Base price"><input type="number" min="0" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></Field>
      </div>
    </Modal>
  </>;
}
