"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Check, Filter } from "lucide-react";
import { crmApi, onCrmDataChanged, type BackendService, type BackendServiceUsage } from "@/lib/api";
import { AddButton, Badge, Button, ErrorState, Field, LoadingState, Modal, PageHeader, SearchField } from "./ui";

export function ServicesView({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<BackendService[]>([]);
  const [usage, setUsage] = useState<BackendServiceUsage[]>([]);
  const [stage, setStage] = useState("All");
  const [niche, setNiche] = useState("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<"add" | null>(null);
  const [name, setName] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [data, stats] = await Promise.all([crmApi.rawServices(), crmApi.serviceUsage()]);
      setItems(data);
      setUsage(stats);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(fetch); }, [fetch]);
  useEffect(() => onCrmDataChanged(fetch), [fetch]);

  const usageByService = useMemo(() => new Map(usage.map((row) => [row.service, row])), [usage]);
  const niches = useMemo(() => Array.from(new Set(usage.flatMap((row) => row.rows.map((line) => line.niche).filter(Boolean)))).sort(), [usage]);
  const filtered = useMemo(() => items.filter((item) => {
    const stat = usageByService.get(item._id);
    const matchesQuery = item.name.toLowerCase().includes(query.toLowerCase());
    const matchesStage = stage === "All" || stat?.rows.some((row) => row.lifecycleStage === stage && row.count > 0);
    const matchesNiche = niche === "All" || stat?.rows.some((row) => row.niche === niche && row.count > 0);
    return matchesQuery && matchesStage && matchesNiche;
  }), [items, query, stage, niche, usageByService]);

  const totals = useMemo(() => ({
    active: usage.reduce((sum, row) => sum + row.rows.filter((line) => line.lifecycleStage === "Active").reduce((inner, line) => inner + line.count, 0), 0),
    inProgress: usage.reduce((sum, row) => sum + row.rows.filter((line) => line.lifecycleStage === "In Progress").reduce((inner, line) => inner + line.count, 0), 0),
    nonActive: usage.reduce((sum, row) => sum + row.rows.filter((line) => line.lifecycleStage === "Not Active").reduce((inner, line) => inner + line.count, 0), 0),
    revenue: usage.reduce((sum, row) => sum + row.revenue, 0),
  }), [usage]);

  const addService = async () => {
    const trimmed = name.trim();
    if (!trimmed || items.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) return;
    try {
      const created = await crmApi.createService({ name: trimmed });
      setItems((prev) => [...prev, created]);
      setName("");
      setModal(null);
      void fetch();
    } catch {
      // Keep the form open for retry.
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState reset={fetch} />;

  return (
    <>
      <PageHeader
        eyebrow="Base catalog"
        title="Services"
        description="Track service usage by active clients, non-active clients, business niche, and revenue. Customer-specific pricing remains inside each client profile."
        action={<AddButton onClick={() => { setName(""); setModal("add"); }}>Add service</AddButton>}
      />
      <section className="toolbar panel" style={{ marginBottom: 14 }}>
        <div className="toolbar-group">
          <SearchField value={query} onChange={setQuery} placeholder="Search service names..." />
          <Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}><Filter size={15} />Filters</Button>
        </div>
        <span style={{ color: "var(--muted)", fontSize: 10 }}>{items.filter((item) => item.active).length} base services</span>
      </section>
      {filtersOpen && <section className="operation-filters" style={{ marginBottom: 14 }}>
        <Field label="Client status"><select value={stage} onChange={(event) => setStage(event.target.value)}><option>All</option><option>Active</option><option>In Progress</option><option>Not Active</option></select></Field>
        <Field label="Business niche"><select value={niche} onChange={(event) => setNiche(event.target.value)}><option>All</option>{niches.map((value) => <option key={value}>{value}</option>)}</select></Field>
        <Button variant="ghost" onClick={() => { setStage("All"); setNiche("All"); }}>Clear filters</Button>
      </section>}
      <section className="mini-stats" style={{ marginBottom: 18 }}>
        <div className="mini-stat"><span>Active clients using services</span><strong>{totals.active}</strong></div>
        <div className="mini-stat"><span>In progress clients</span><strong>{totals.inProgress}</strong></div>
        <div className="mini-stat"><span>Non-active clients</span><strong>{totals.nonActive}</strong></div>
        <div className="mini-stat"><span>Service revenue</span><strong>${totals.revenue.toLocaleString()}</strong></div>
      </section>
      <section className="cards-grid" data-testid="services-grid">
        {filtered.map((item) => {
          const stat = usageByService.get(item._id);
          const active = stat?.rows.filter((row) => row.lifecycleStage === "Active").reduce((sum, row) => sum + row.count, 0) ?? 0;
          const inProgress = stat?.rows.filter((row) => row.lifecycleStage === "In Progress").reduce((sum, row) => sum + row.count, 0) ?? 0;
          const nonActive = stat?.rows.filter((row) => row.lifecycleStage === "Not Active").reduce((sum, row) => sum + row.count, 0) ?? 0;
          const topNiches = Array.from(new Map((stat?.rows ?? []).map((row) => [row.niche, row.count])).entries()).filter(([value]) => value).slice(0, 3);
          return (
            <article className="service-card hover-lift" key={item._id}>
              <div className="service-card-head">
                <span className="service-icon"><BriefcaseBusiness size={18} /></span>
                <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "Available" : "Disabled"}</Badge>
              </div>
              <h3>{item.name}</h3>
              <p>{stat?.totalClients ?? 0} clients use this service. ${Number(stat?.revenue ?? 0).toLocaleString()} revenue tracked.</p>
              <div className="mini-stats" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", margin: "12px 0" }}>
                <div className="mini-stat"><span>Active</span><strong>{active}</strong></div>
                <div className="mini-stat"><span>In progress</span><strong>{inProgress}</strong></div>
                <div className="mini-stat"><span>Non-active</span><strong>{nonActive}</strong></div>
              </div>
              <footer><span>{topNiches.length ? topNiches.map(([value, count]) => `${value} (${count})`).join(", ") : "No client niche data yet."}</span></footer>
            </article>
          );
        })}
      </section>

      <Modal
        open={modal === "add"}
        onClose={() => setModal(null)}
        title="Add base service"
        description="This service becomes selectable in client services, invoices, and upsells."
        footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={addService}><Check size={14} />Add service</Button></>}
      >
        <div className="form-grid">
          <Field label="Service name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Service name" /></Field>
        </div>
      </Modal>
    </>
  );
}
