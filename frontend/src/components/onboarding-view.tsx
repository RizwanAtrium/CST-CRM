"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, ChevronRight, Filter } from "lucide-react";
import { crmApi, onCrmDataChanged, type BackendOnboarding } from "@/lib/api";
import { Avatar, Badge, Button, Field, PageHeader, LoadingState, ErrorState } from "./ui";

type BoardColumn = {
  title: string;
  color: string;
  filterStatus: string;
  cards: BackendOnboarding[];
};

const STAGE_ORDER = ["In Progress", "Ready for review", "Graduating this week"];

function statusToStage(status: string | undefined): string {
  if (!status) return "In Progress";
  const lower = status.toLowerCase();
  if (lower.includes("review") || lower.includes("ready")) return "Ready for review";
  if (lower.includes("graduate") || lower.includes("graduating")) return "Graduating this week";
  return "In Progress";
}

/** Compute approximate day from workStartDate (fallback to index if unavailable) */
function computeDay(client: BackendOnboarding, index: number): number {
  const clientObj = typeof client.client === "object" ? client.client : null;
  if (!clientObj?.workStartDate) return index * 7 + 1;
  const start = new Date(clientObj.workStartDate);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(30, diff + 1));
}

function extractClientName(client: BackendOnboarding["client"]): string {
  if (typeof client === "object" && client) return client.businessName || client.customerName || "Unknown";
  return "Unknown";
}

function extractCustomerName(client: BackendOnboarding["client"]): string {
  if (typeof client === "object" && client) return client.customerName || "";
  return "";
}

function extractHandlerName(client: BackendOnboarding["client"]): string {
  if (typeof client === "object" && client?.cstHandler && typeof client.cstHandler === "object") {
    return client.cstHandler.name || "Unassigned";
  }
  return "Unassigned";
}

function extractWorkStart(client: BackendOnboarding["client"]): string {
  if (typeof client === "object" && client?.workStartDate) return client.workStartDate;
  return "";
}

function getDelaySide(record: BackendOnboarding): string {
  return record.delaySide || "N/A";
}

function hasOurSideDelay(record: BackendOnboarding): boolean {
  return record.delaySide === "Our";
}

export function OnboardingView() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [handler, setHandler] = useState("All");
  const [data, setData] = useState<BackendOnboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const list = await crmApi.onboardingList();
      setData(list);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(fetch); }, [fetch]);
  useEffect(() => onCrmDataChanged(fetch), [fetch]);

  const board = useMemo((): BoardColumn[] => {
    const columns = STAGE_ORDER.map((title) => {
      const color =
        title === "In Progress" ? "var(--amber)" :
        title === "Ready for review" ? "var(--primary)" :
        "var(--green)";
      const filterStatus = title;
      const cards = data.filter((record) => {
        const stage = statusToStage(
          record.onboardStatus ??
          (typeof record.client === "object" && record.client?.lifecycleStage
            ? record.client.lifecycleStage
            : "")
        );
        return stage === filterStatus;
      });
      return { title, color, filterStatus, cards };
    });

    // If some records don't match any stage column, put them in "In Progress"
    const unmatched = data.filter((record) => {
      const stage = statusToStage(
        record.onboardStatus ??
        (typeof record.client === "object" && record.client?.lifecycleStage
          ? record.client.lifecycleStage
          : "")
      );
      return !STAGE_ORDER.includes(stage);
    });
    if (unmatched.length > 0) {
      columns[0].cards = [...columns[0].cards, ...unmatched];
    }

    return columns;
  }, [data]);

  const filteredBoard = useMemo(() =>
    board.map((column) => ({
      ...column,
      cards:
        handler === "All"
          ? column.cards
          : column.cards.filter((record) => extractHandlerName(record.client) === handler),
    })),
    [board, handler],
  );

  // Collect unique handler names from data
  const handlers = useMemo(() => {
    const set = new Set<string>();
    data.forEach((record) => {
      const name = extractHandlerName(record.client);
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [data]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState reset={fetch} />;

  const inProgressCount = board[0]?.cards.length ?? 0;
  const onTrackCount = board.slice(1).reduce((sum, col) => sum + col.cards.length, 0);
  const ourDelayCount = data.filter(hasOurSideDelay).length;

  return (
    <>
      <PageHeader
        eyebrow="0–30 day lifecycle"
        title="Onboarding pipeline"
        description="Track access, milestones, delays, and automatic Day-30 graduation."
        action={<Link className="button primary" href="/clients">Add client</Link>}
        secondary={
          <Button variant="secondary" onClick={() => setFiltersOpen((value) => !value)}>
            <Filter size={15} />Filter board
          </Button>
        }
      />
      <section className="mini-stats">
        <div className="mini-stat"><span>In progress</span><strong>{inProgressCount}</strong></div>
        <div className="mini-stat"><span>On track</span><strong>{onTrackCount}</strong></div>
        <div className="mini-stat">
          <span>Our-side delays</span>
          <strong style={{ color: ourDelayCount > 0 ? "var(--red)" : undefined }}>{ourDelayCount}</strong>
        </div>
        <div className="mini-stat"><span>Total clients</span><strong>{data.length}</strong></div>
      </section>
      {filtersOpen && (
        <section className="panel operation-filters" style={{ marginBottom: 14 }}>
          <Field label="CST handler">
            <select value={handler} onChange={(event) => setHandler(event.target.value)}>
              <option>All</option>
              {handlers.map((h) => <option key={h}>{h}</option>)}
            </select>
          </Field>
          <Button variant="ghost" onClick={() => setHandler("All")}>Clear filter</Button>
        </section>
      )}
      <section className="kanban" data-testid="onboarding-kanban">
        {filteredBoard.map((column) => (
          <article className="kanban-column" key={column.title}>
            <header className="kanban-head">
              <strong><i style={{ background: column.color }} />{column.title}</strong>
              <span>{column.cards.length}</span>
            </header>
            {column.cards.map((record, index) => {
              const clientId =
                typeof record.client === "object" && record.client ? record.client._id : record._id;
              const businessName = extractClientName(record.client);
              const customerName = extractCustomerName(record.client);
              const handlerName = extractHandlerName(record.client);
              const workStart = extractWorkStart(record.client);
              const day = computeDay(record, index);
              const ourDelay = hasOurSideDelay(record);

              return (
                <Link
                  href={`/onboarding/${clientId}`}
                  className="kanban-card kanban-card-link"
                  key={record._id}
                >
                  <div>
                    <div>
                      <h3>{businessName}</h3>
                      {customerName && <p>{customerName}</p>}
                    </div>
                    <span className="table-action" aria-label={`Open onboarding for ${businessName}`}>
                      <ChevronRight size={16} />
                    </span>
                  </div>
                  {ourDelay && (
                    <div style={{ marginTop: 10 }}>
                      <Badge tone="danger"><AlertTriangle size={10} />Our-side delay</Badge>
                    </div>
                  )}
                  <div className="kanban-meta">
                    <span>Day {day}</span>
                    <span>{handlerName}</span>
                  </div>
                  <div className="check-row">
                    <span className={record.calledSameDay ? "done" : ""} />
                    <span className={record.welcomeMsgSameDay ? "done" : ""} />
                    <span className={record.accessReceived ? "done" : ""} />
                  </div>
                  <footer>
                    <span>
                      <CalendarClock size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />
                      {workStart ? `Started ${workStart.slice(5)}` : "No start date"}
                    </span>
                    <Avatar name={handlerName} tone="violet" />
                  </footer>
                </Link>
              );
            })}
          </article>
        ))}
      </section>
    </>
  );
}
