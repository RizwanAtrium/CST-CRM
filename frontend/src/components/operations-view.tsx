"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Ellipsis, Filter, Pencil } from "lucide-react";
import { crmApi, onCrmDataChanged } from "@/lib/api";
import type { BackendContact, BackendComplaint, BackendReport, BackendUpsell } from "@/lib/api";
import type { Client, Status } from "@/lib/types";
import { AddButton, Badge, Button, Field, LoadingState, Modal, PageHeader, SearchField } from "./ui";

type OperationType = "contacts" | "reports" | "complaints" | "upsells";
type OperationKind = "Contact" | "Report" | "Complaint" | "Upsell";
type OperationStatus = Status | "In Progress";
type Config = {
  kind: OperationKind;
  eyebrow: string;
  title: string;
  description: string;
  add: string;
};
type OperationRow = {
  id: string;
  kind: OperationKind;
  client: string;
  date: string;
  dateIso: string;
  detail: string;
  notes: string;
  contactType?: "Complaint" | "Report" | "Upsell" | "Simple contact";
  nextReachBack?: string;
  owner: string;
  status: OperationStatus;
  value?: number;
};
type Draft = {
  client: string;
  dateIso: string;
  detail: string;
  contactType: "Complaint" | "Report" | "Upsell" | "Simple contact";
  nextReachBack: string;
  notes: string;
  owner: string;
  status: OperationStatus;
  value: number;
};

const tone = (status: Status | "In Progress") =>
  status === "Resolved" || status === "Converted" || status === "Sent"
    ? "success"
    : status === "Open" || status === "Late"
    ? "danger"
    : status === "Pending" || status === "In Progress"
    ? "warning"
    : "neutral";

const statusOptions: Record<OperationType, OperationStatus[]> = {
  contacts: ["Resolved"],
  reports: ["Pending", "Sent", "Late"],
  complaints: ["Open", "Resolved"],
  upsells: ["In Progress", "Converted", "Lost"],
};

const formatDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

function parseClientField(
  clientField: string | { _id: string; businessName: string },
): string {
  return typeof clientField === "object" ? clientField.businessName : clientField;
}

function mapContact(item: BackendContact): OperationRow {
  return {
    id: item._id,
    kind: "Contact",
    client: parseClientField(item.client),
    date: formatDate(item.contactDate),
    dateIso: item.contactDate,
    detail: item.channel,
    notes: item.notes,
    contactType: item.contactType as OperationRow["contactType"],
    nextReachBack: item.nextReachBackDate,
    owner: "",
    status: "Resolved",
  };
}

function mapComplaint(item: BackendComplaint): OperationRow {
  return {
    id: item._id,
    kind: "Complaint",
    client: parseClientField(item.client),
    date: formatDate(item.dateRaised),
    dateIso: item.dateRaised,
    detail: item.details,
    notes: item.details,
    owner: "",
    status: item.resolved ? "Resolved" : "Open",
  };
}

function mapReport(item: BackendReport): OperationRow {
  return {
    id: item._id,
    kind: "Report",
    client: parseClientField(item.client),
    date: formatDate(item.dueDate),
    dateIso: item.dueDate,
    detail: item.label,
    notes: "",
    owner: "",
    status: item.status as OperationStatus,
  };
}

function mapUpsell(item: BackendUpsell): OperationRow {
  return {
    id: item._id,
    kind: "Upsell",
    client: parseClientField(item.client),
    date: formatDate(item.upsellDate ?? ""),
    dateIso: item.upsellDate ?? "",
    detail: item.servicePitched,
    notes: "",
    owner: "",
    status: item.status as OperationStatus,
    value: item.revenue,
  };
}

function createEmptyDraft(type: OperationType): Draft {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    client: "",
    dateIso: new Date().toISOString().slice(0, 10),
    detail:
      type === "contacts"
        ? "Phone"
        : type === "reports"
        ? "Retention Report 1"
        : "",
    contactType: "Simple contact",
    nextReachBack: type === "contacts" ? tomorrow.toISOString().slice(0, 10) : "",
    notes: "",
    owner: "",
    status: statusOptions[type][0],
    value: 0,
  };
}

const operationConfigs: Record<OperationType, Config> = {
  contacts: {
    kind: "Contact",
    eyebrow: "Client engagement",
    title: "Contact log",
    description:
      "Weekly touch records reset automatically by date. Target: 3 per eligible client.",
    add: "Log contact",
  },
  reports: {
    kind: "Report",
    eyebrow: "Scheduled deliverables",
    title: "Reports",
    description:
      "Retention and onboarding reports with monthly status tracking.",
    add: "Log report",
  },
  complaints: {
    kind: "Complaint",
    eyebrow: "Issue resolution",
    title: "Complaints",
    description:
      "One source record per complaint from raised date through resolution.",
    add: "Log complaint",
  },
  upsells: {
    kind: "Upsell",
    eyebrow: "Expansion pipeline",
    title: "Upsells",
    description:
      "Track pitches, conversions, lost opportunities, and new revenue.",
    add: "New opportunity",
  },
};

export function OperationsView({
  type,
  initialStatus = "All",
  initialFrom = "",
  initialTo = "",
}: {
  type: OperationType;
  initialStatus?: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  const config: Config = operationConfigs[type];
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OperationRow[]>([]);
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"add" | "detail" | "edit" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => createEmptyDraft(type));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [clientFilter, setClientFilter] = useState("All");
  const [serviceFilter, setServiceFilter] = useState("All");
  const [minRevenue, setMinRevenue] = useState("");
  const [maxRevenue, setMaxRevenue] = useState("");

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("All");
    setFrom("");
    setTo("");
    setOwnerFilter("All");
    setClientFilter("All");
    setServiceFilter("All");
    setMinRevenue("");
    setMaxRevenue("");
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const clientsData = await crmApi.clients();
      setClientsList(clientsData);

      let rawData:
        | BackendContact[]
        | BackendComplaint[]
        | BackendReport[]
        | BackendUpsell[];
      if (type === "contacts") rawData = await crmApi.contacts();
      else if (type === "reports") rawData = await crmApi.reports();
      else if (type === "complaints") rawData = await crmApi.complaints();
      else rawData = await crmApi.upsells();

      const mapped =
        type === "contacts"
          ? (rawData as BackendContact[]).map(mapContact)
          : type === "reports"
          ? (rawData as BackendReport[]).map(mapReport)
          : type === "complaints"
          ? (rawData as BackendComplaint[]).map(mapComplaint)
          : (rawData as BackendUpsell[]).map(mapUpsell);

      const handlerMap = new Map(
        clientsData.map((c) => [c.businessName, c.handler]),
      );
      const enriched = mapped.map((row) => ({
        ...row,
        owner: handlerMap.get(row.client) ?? "",
      }));

      setRows(enriched);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void Promise.resolve().then(fetchData);
  }, [fetchData]);
  useEffect(() => onCrmDataChanged(fetchData), [fetchData]);

  useEffect(() => {
    if (clientsList.length > 0 && !draft.client) {
      const timer = window.setTimeout(() => setDraft((prev) => ({ ...prev, client: clientsList[0].businessName })), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [clientsList, draft.client]);

  const clientIdMap = useMemo(
    () => new Map(clientsList.map((c) => [c.businessName, c.id])),
    [clientsList],
  );

  const clientByName = useMemo(
    () => new Map(clientsList.map((c) => [c.businessName, c])),
    [clientsList],
  );

  const clientNames = useMemo(
    () => clientsList.map((c) => c.businessName).sort(),
    [clientsList],
  );

  const clientRevenue = useCallback(
    (clientName: string) => clientByName.get(clientName)?.mrr ?? 0,
    [clientByName],
  );

  const cstOwners = useMemo(
    () => Array.from(new Set(rows.map((r) => r.owner))).sort(),
    [rows],
  );

  const serviceOptions = useMemo(() => {
    if (type === "upsells") {
      return Array.from(new Set(rows.map((r) => r.detail))).sort();
    }
    return Array.from(new Set(clientsList.flatMap((c) => c.services))).sort();
  }, [type, rows, clientsList]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const openAdd = () => {
    setSelectedId(null);
    setDraft(createEmptyDraft(type));
    if (clientsList.length > 0) {
      setDraft((prev) => ({ ...prev, client: clientsList[0].businessName }));
    }
    setModal("add");
  };

  const openDetail = (row: OperationRow) => {
    setSelectedId(row.id);
    setModal("detail");
  };

  const openEdit = () => {
    if (!selected) return;
    setDraft({
      client: selected.client,
      dateIso: selected.dateIso,
      detail: selected.detail,
      contactType: selected.contactType ?? "Simple contact",
      nextReachBack: selected.nextReachBack ?? "",
      notes: selected.notes,
      owner: selected.owner,
      status: selected.status,
      value: selected.value ?? 0,
    });
    setModal("edit");
  };

  const save = async () => {
    if (
      !draft.client ||
      !draft.dateIso ||
      !draft.detail.trim() ||
      (type === "contacts" && (!draft.nextReachBack || !draft.notes.trim()))
    )
      return;

    const clientId = clientIdMap.get(draft.client);
    if (!clientId) return;

    const handlerMap = new Map(
      clientsList.map((c) => [c.businessName, c.handler]),
    );

    try {
      if (modal === "add") {
        let newItem: OperationRow | null = null;
        if (type === "contacts") {
          const created = await crmApi.createContact({
            client: clientId,
            contactDate: draft.dateIso,
            contactType: draft.contactType,
            channel: draft.detail,
            notes: draft.notes,
            nextReachBackDate: draft.nextReachBack,
          });
          newItem = mapContact(created);
        } else if (type === "reports") {
          const created = await crmApi.createReport({
            client: clientId,
            category: "Retention",
            label: draft.detail,
            periodMonth: draft.dateIso.slice(0, 7),
            dueDate: draft.dateIso,
          });
          newItem = mapReport(created);
        } else if (type === "complaints") {
          const created = await crmApi.createComplaint({
            client: clientId,
            dateRaised: draft.dateIso,
            details: draft.detail,
            resolved: draft.status === "Resolved",
          });
          newItem = mapComplaint(created);
        } else if (type === "upsells") {
          const created = await crmApi.createUpsell({
            client: clientId,
            servicePitched: draft.detail,
            revenue: draft.value,
            upsellDate: draft.dateIso,
            status: draft.status,
          });
          newItem = mapUpsell(created);
        }
        if (newItem) {
          newItem.owner = handlerMap.get(newItem.client) ?? "";
          setRows((prev) => [newItem!, ...prev]);
        }
      } else if (modal === "edit" && selectedId) {
        let updatedItem: OperationRow | null = null;
        if (type === "contacts") {
          const updated = await crmApi.updateContact(selectedId, {
            client: clientId,
            contactDate: draft.dateIso,
            contactType: draft.contactType,
            channel: draft.detail,
            notes: draft.notes,
            nextReachBackDate: draft.nextReachBack,
          });
          updatedItem = mapContact(updated);
        } else if (type === "reports") {
          const updated = await crmApi.updateReport(selectedId, {
            label: draft.detail,
            dueDate: draft.dateIso,
          });
          updatedItem = mapReport(updated);
        } else if (type === "complaints") {
          const updated = await crmApi.updateComplaint(selectedId, {
            details: draft.detail,
            resolved: draft.status === "Resolved",
          });
          updatedItem = mapComplaint(updated);
        } else if (type === "upsells") {
          const updated = await crmApi.updateUpsell(selectedId, {
            servicePitched: draft.detail,
            revenue: draft.value,
            upsellDate: draft.dateIso,
            status: draft.status,
          });
          updatedItem = mapUpsell(updated);
        }
        if (updatedItem) {
          updatedItem.owner = handlerMap.get(updatedItem.client) ?? "";
          setRows((prev) =>
            prev.map((row) => (row.id === selectedId ? updatedItem! : row)),
          );
        }
      }
      setModal(null);
    } catch {
      // API error — data not saved
    }
  };

  const setSelectedStatus = async (newStatus: OperationStatus) => {
    if (!selected) return;
    try {
      if (type === "contacts") {
        // Backend contacts have no status field — update locally only
      } else if (type === "reports") {
        await crmApi.updateReport(selected.id, { dateSent: newStatus === "Sent" ? new Date().toISOString() : null });
      } else if (type === "complaints") {
        await crmApi.updateComplaint(selected.id, {
          resolved: newStatus === "Resolved",
        });
      } else if (type === "upsells") {
        await crmApi.updateUpsell(selected.id, { status: newStatus });
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === selected.id ? { ...row, status: newStatus } : row,
        ),
      );
      setModal("detail");
    } catch {
      // API error — status not updated
    }
  };

  const exportCsv = () => {
    const csv = [
      [
        "Client",
        "Record",
        "Date",
        "Owner",
        "Status",
        "Revenue",
        "Notes",
      ],
      ...visibleRows.map((row) => [
        row.client,
        row.detail,
        row.dateIso,
        row.owner,
        row.status,
        String(row.value ?? ""),
        row.notes,
      ]),
    ]
      .map((line) =>
        line.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}-export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        const client = clientByName.get(row.client);
        const clientServices = client?.services ?? [];
        const revenue =
          type === "upsells" ? row.value ?? 0 : client?.mrr ?? 0;
        const min = minRevenue ? Number(minRevenue) : null;
        const max = maxRevenue ? Number(maxRevenue) : null;
        const matchesQuery = `${row.client} ${row.detail} ${row.owner} ${row.notes} ${clientServices.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesOwner =
          ownerFilter === "All" || row.owner === ownerFilter;
        const matchesClient =
          clientFilter === "All" || row.client === clientFilter;
        const matchesService =
          serviceFilter === "All" ||
          (type === "upsells"
            ? row.detail === serviceFilter ||
              clientServices.includes(serviceFilter)
            : clientServices.includes(serviceFilter));
        const matchesRevenue =
          (min === null || revenue >= min) &&
          (max === null || revenue <= max);
        return (
          matchesQuery &&
          matchesOwner &&
          matchesClient &&
          matchesService &&
          matchesRevenue &&
          (statusFilter === "All" || row.status === statusFilter) &&
          (!from || row.dateIso >= from) &&
          (!to || row.dateIso <= to)
        );
      }),
    [
      rows,
      query,
      ownerFilter,
      clientFilter,
      serviceFilter,
      statusFilter,
      from,
      to,
      minRevenue,
      maxRevenue,
      type,
      clientByName,
    ],
  );

  const stats = useMemo(() => {
    if (type === "contacts")
      return [
        ["Contacts logged", rows.length],
        ["Clients reached", new Set(rows.map((row) => row.client)).size],
        [
          "Phone calls",
          rows.filter((row) => row.detail === "Phone call").length,
        ],
        ["This view", visibleRows.length],
      ];
    if (type === "reports")
      return [
        ["Total reports", visibleRows.length],
        ["Sent", visibleRows.filter((row) => row.status === "Sent").length],
        [
          "Pending",
          visibleRows.filter((row) => row.status === "Pending").length,
        ],
        ["Late", visibleRows.filter((row) => row.status === "Late").length],
      ];
    if (type === "complaints")
      return [
        ["Total logged", visibleRows.length],
        [
          "Resolved",
          visibleRows.filter((row) => row.status === "Resolved").length,
        ],
        [
          "Still open",
          visibleRows.filter((row) => row.status === "Open").length,
        ],
        [
          "Resolution rate",
          `${
            visibleRows.length
              ? Math.round(
                  (visibleRows.filter((row) => row.status === "Resolved")
                    .length /
                    visibleRows.length) *
                    100,
                )
              : 0
          }%`,
        ],
      ];
    return [
      [
        "Pipeline",
        `$${visibleRows
          .filter((row) => row.status === "In Progress")
          .reduce((sum, row) => sum + (row.value ?? 0), 0)
          .toLocaleString()}`,
      ],
      ["Converted", visibleRows.filter((row) => row.status === "Converted").length],
      [
        "Revenue",
        `$${visibleRows
          .filter((row) => row.status === "Converted")
          .reduce((sum, row) => sum + (row.value ?? 0), 0)
          .toLocaleString()}`,
      ],
      ["Lost", visibleRows.filter((row) => row.status === "Lost").length],
    ];
  }, [rows, type, visibleRows]);

  if (loading) return <LoadingState />;

  return (
    <>
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        action={
          <AddButton onClick={openAdd} testId={`add-${config.kind.toLowerCase()}`}>
            {config.add}
          </AddButton>
        }
        secondary={
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={15} />
            Export CSV
          </Button>
        }
      />
      <section className="mini-stats">
        {stats.map(([label, value]) => (
          <div className="mini-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section
        className="panel"
        data-testid={`${config.kind.toLowerCase()}-table`}
      >
        <div className="toolbar">
          <div className="toolbar-group">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={`Search ${config.title.toLowerCase()}…`}
            />
            <Button
              variant="secondary"
              onClick={() => setFiltersOpen((value) => !value)}
            >
              <Filter size={15} />
              Filters
            </Button>
          </div>
          <div className="filter-tabs" aria-label={`${config.title} status filter`}>
            {["All", ...statusOptions[type]].map((status) => (
              <button
                key={status}
                className={statusFilter === status ? "active" : ""}
                onClick={() => setStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        {filtersOpen && (
          <div className="operation-filters">
            <Field label="Status">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option>All</option>
                {statusOptions[type].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </Field>
            <Field label="CST person">
              <select
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
              >
                <option>All</option>
                {cstOwners.map((owner) => (
                  <option key={owner}>{owner}</option>
                ))}
              </select>
            </Field>
            <Field label="Client">
              <select
                value={clientFilter}
                onChange={(event) => setClientFilter(event.target.value)}
              >
                <option>All</option>
                {clientNames.map((client) => (
                  <option key={client}>{client}</option>
                ))}
              </select>
            </Field>
            {(type === "reports" ||
              type === "complaints" ||
              type === "upsells") && (
              <Field label="Service">
                <select
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value)}
                >
                  <option>All</option>
                  {serviceOptions.map((service) => (
                    <option key={service}>{service}</option>
                  ))}
                </select>
              </Field>
            )}
            {(type === "complaints" || type === "upsells") && (
              <>
                <Field label="Revenue from">
                  <input
                    type="number"
                    min="0"
                    value={minRevenue}
                    onChange={(event) => setMinRevenue(event.target.value)}
                    placeholder={
                      type === "upsells"
                        ? "Minimum revenue"
                        : "Minimum MRR"
                    }
                  />
                </Field>
                <Field label="Revenue to">
                  <input
                    type="number"
                    min="0"
                    value={maxRevenue}
                    onChange={(event) => setMaxRevenue(event.target.value)}
                    placeholder={
                      type === "upsells"
                        ? "Maximum revenue"
                        : "Maximum MRR"
                    }
                  />
                </Field>
              </>
            )}
            <Field label="From">
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>
                  {config.kind === "Contact"
                    ? "Channel"
                    : config.kind === "Upsell"
                    ? "Service pitched"
                    : "Record"}
                </th>
                <th>Date</th>
                <th>Owner</th>
                {(config.kind === "Upsell" || config.kind === "Complaint") && (
                  <th>Revenue</th>
                )}
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.client}</strong>
                  </td>
                  <td>{row.detail}</td>
                  <td>{row.date}</td>
                  <td>{row.owner}</td>
                  {config.kind === "Upsell" && (
                    <td>
                      <strong>${row.value?.toLocaleString()}</strong>
                    </td>
                  )}
                  {config.kind === "Complaint" && (
                    <td>
                      <strong>
                        ${clientRevenue(row.client).toLocaleString()}
                      </strong>
                    </td>
                  )}
                  <td>
                    <Badge tone={tone(row.status)}>{row.status}</Badge>
                  </td>
                  <td>
                    <button
                      className="table-action"
                      onClick={() => openDetail(row)}
                      aria-label={`Open ${config.kind.toLowerCase()} for ${row.client}`}
                    >
                      <Ellipsis size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRows.length === 0 && (
            <div className="inline-empty">No matching records</div>
          )}
        </div>
      </section>

      <Modal
        open={modal === "add" || modal === "edit"}
        onClose={() => setModal(null)}
        title={modal === "edit" ? `Edit ${config.kind.toLowerCase()}` : config.add}
        description={`Save a raw ${config.kind.toLowerCase()} record for computed dashboards.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save}>
              <CheckCircle2 size={15} />
              Save record
            </Button>
          </>
        }
      >
        <OperationForm
          type={type}
          draft={draft}
          setDraft={setDraft}
          clientsList={clientsList}
        />
      </Modal>
      <Modal
        open={modal === "detail" && Boolean(selected)}
        onClose={() => setModal(null)}
        title={`${config.kind} details`}
        description={
          selected ? `${selected.client} · ${selected.date}` : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={openEdit}>
              <Pencil size={14} />
              Edit
            </Button>
            {selected && type === "reports" && selected.status !== "Sent" && (
              <Button onClick={() => setSelectedStatus("Sent")}>
                Mark sent
              </Button>
            )}
            {selected && type === "complaints" && (
              <Button
                onClick={() =>
                  setSelectedStatus(
                    selected.status === "Resolved" ? "Open" : "Resolved",
                  )
                }
              >
                {selected.status === "Resolved" ? "Reopen" : "Resolve"}
              </Button>
            )}
            {selected &&
              type === "upsells" &&
              selected.status === "In Progress" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedStatus("Lost")}
                  >
                    Mark lost
                  </Button>
                  <Button onClick={() => setSelectedStatus("Converted")}>
                    Convert
                  </Button>
                </>
              )}
          </>
        }
      >
        {selected && (
          <div className="detail-list">
            <div>
              <span>Client</span>
              <strong>{selected.client}</strong>
            </div>
            <div>
              <span>Status</span>
              <Badge tone={tone(selected.status)}>{selected.status}</Badge>
            </div>
            {type === "contacts" && (
              <div>
                <span>Contact type</span>
                <strong>{selected.contactType}</strong>
              </div>
            )}
            <div>
              <span>
                {type === "contacts"
                  ? "Channel"
                  : type === "upsells"
                  ? "Service pitched"
                  : "Record"}
              </span>
              <strong>{selected.detail}</strong>
            </div>
            <div>
              <span>Date</span>
              <strong>{selected.date}</strong>
            </div>
            {type === "contacts" && (
              <div>
                <span>Next reach-back</span>
                <strong>{selected.nextReachBack}</strong>
              </div>
            )}
            <div>
              <span>Owner</span>
              <strong>{selected.owner}</strong>
            </div>
            {type === "upsells" && (
              <div>
                <span>Revenue</span>
                <strong>${selected.value?.toLocaleString()}</strong>
              </div>
            )}
            {type === "complaints" && (
              <div>
                <span>Client revenue</span>
                <strong>
                  ${clientRevenue(selected.client).toLocaleString()}
                </strong>
              </div>
            )}
            <div>
              <span>Notes</span>
              <strong>{selected.notes || "No notes"}</strong>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function OperationForm({
  type,
  draft,
  setDraft,
  clientsList,
}: {
  type: OperationType;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  clientsList: Client[];
}) {
  const update = <K extends keyof Draft>(
    key: K,
    value: Draft[K],
  ) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="form-grid">
      <Field label="Client">
        <select
          value={draft.client}
          onChange={(event) => update("client", event.target.value)}
        >
          {clientsList.length === 0 && <option value="">Loading…</option>}
          {clientsList.map((client) => (
            <option key={client.id}>{client.businessName}</option>
          ))}
        </select>
      </Field>
      <Field label="Date">
        <input
          type="date"
          value={draft.dateIso}
          onChange={(event) => update("dateIso", event.target.value)}
        />
      </Field>
      {type === "contacts" && (
        <>
          <Field label="Contact type *">
            <select
              value={draft.contactType}
              onChange={(event) =>
                update(
                  "contactType",
                  event.target.value as Draft["contactType"],
                )
              }
            >
              <option>Simple contact</option>
              <option>Complaint</option>
              <option>Report</option>
              <option>Upsell</option>
            </select>
          </Field>
          <Field label="Channel *">
            <select
              value={draft.detail}
              onChange={(event) => update("detail", event.target.value)}
            >
              <option>Phone</option>
              <option>Email</option>
              <option>WhatsApp</option>
              <option>Video</option>
            </select>
          </Field>
          <Field label="Next reach-back date *">
            <input
              type="date"
              value={draft.nextReachBack}
              onChange={(event) => update("nextReachBack", event.target.value)}
            />
          </Field>
        </>
      )}
      {type === "reports" && (
        <Field label="Report label">
          <select
            value={draft.detail}
            onChange={(event) => update("detail", event.target.value)}
          >
            <option>Retention Report 1</option>
            <option>Retention Report 2</option>
            <option>Onboarding Week 1</option>
            <option>Onboarding Biweekly</option>
            <option>Onboarding Monthly</option>
          </select>
        </Field>
      )}
      {type === "complaints" && (
        <Field label="Complaint details">
          <input
            value={draft.detail}
            onChange={(event) => update("detail", event.target.value)}
            placeholder="Describe the issue"
          />
        </Field>
      )}
      {type === "upsells" && (
        <>
          <Field label="Service pitched">
            <input
              value={draft.detail}
              onChange={(event) => update("detail", event.target.value)}
              placeholder="Service"
            />
          </Field>
          <Field label="Revenue">
            <input
              type="number"
              min="0"
              value={draft.value}
              onChange={(event) => update("value", Number(event.target.value))}
            />
          </Field>
        </>
      )}
      <Field label={type === "complaints" ? "Forwarded to" : "Owner"}>
        <input value={draft.owner} onChange={(event) => update("owner", event.target.value)} />
      </Field>
      {type !== "contacts" && (
        <Field label="Status">
          <select
            value={draft.status}
            onChange={(event) =>
              update("status", event.target.value as OperationStatus)
            }
          >
            {statusOptions[type].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
      )}
      <div className="field full">
        <Field label={type === "contacts" ? "Notes *" : "Notes"}>
          <textarea
            value={draft.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Add context..."
          />
        </Field>
      </div>
    </div>
  );
}
