"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Check } from "lucide-react";
import { crmApi, type BackendService } from "@/lib/api";
import { AddButton, Badge, Button, Field, Modal, PageHeader, SearchField, LoadingState, ErrorState } from "./ui";

export function ServicesView({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState<BackendService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<"add" | null>(null);
  const [name, setName] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await crmApi.rawServices();
      setItems(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(fetch); }, [fetch]);

  const filtered = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );

  const addService = async () => {
    const trimmed = name.trim();
    if (!trimmed || items.some((item) => item.name.toLowerCase() === trimmed.toLowerCase())) return;
    try {
      const created = await crmApi.createService({ name: trimmed });
      setItems((prev) => [...prev, created]);
      setName("");
      setModal(null);
    } catch {
      // silently fail — the form stays open for retry
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState reset={fetch} />;

  return (
    <>
      <PageHeader
        eyebrow="Base catalog"
        title="Services"
        description="Internal list of services available while creating or editing client profiles. Customer-specific pricing is managed only inside each client profile."
        action={<AddButton onClick={() => { setName(""); setModal("add"); }}>Add service</AddButton>}
      />
      <section className="toolbar panel" style={{ marginBottom: 14 }}>
        <SearchField value={query} onChange={setQuery} placeholder="Search service names…" />
        <span style={{ color: "var(--muted)", fontSize: 10 }}>
          {items.filter((item) => item.active).length} base services
        </span>
      </section>
      <section className="cards-grid" data-testid="services-grid">
        {filtered.map((item) => (
          <article className="service-card hover-lift" key={item._id}>
            <div className="service-card-head">
              <span className="service-icon"><BriefcaseBusiness size={18} /></span>
              <Badge tone={item.active ? "success" : "neutral"}>
                {item.active ? "Available" : "Disabled"}
              </Badge>
            </div>
            <h3>{item.name}</h3>
            <p>Available for client profiles, invoices, and upsell selections.</p>
            <footer>
              <span>Client-specific pricing stays inside the client profile.</span>
            </footer>
          </article>
        ))}
      </section>

      <Modal
        open={modal === "add"}
        onClose={() => setModal(null)}
        title="Add base service"
        description="This service will become selectable inside Add/Edit Client profile forms."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={addService}><Check size={14} />Add service</Button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Service name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Service name"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
