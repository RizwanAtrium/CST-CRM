import { clearSession, getAccessToken, type AuthSession, type AuthUser } from "./auth";
import type { ActivityRecord, Client, DashboardData, Invoice } from "./types";

export type ApiUserRole = "SUPER_ADMIN" | "DIRECTOR" | "CST_MANAGER" | "CST_HANDLER" | "CST";
export type ApiTeamUser = {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: ApiUserRole;
  manager?: string | { _id?: string; id?: string; name?: string; email?: string; role?: ApiUserRole } | null;
  active?: boolean;
  lastActive?: string;
};

export type ApiAssignmentClient = {
  _id?: string;
  id?: string;
  businessName: string;
  cstHandler?: string | { _id?: string; id?: string; name?: string; email?: string } | null;
  handler?: string;
};

export type ApiWorkspaceSettings = {
  name: string;
  timezone: string;
  currency: string;
  weekStart: string;
  description: string;
  issueOffset: string;
  shortMonth: string;
  autoGeneration: string;
  delayAlerts: string;
  recipient: string;
  invoiceDigest: string;
  reportReminder: string;
};

export type ApiJobRun = {
  _id?: string;
  id?: string;
  job: string;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  startedAt?: string;
  finishedAt?: string;
  createdAt?: string;
  summary?: unknown;
  error?: string;
};

export type ApiChatUser = {
  _id?: string;
  id?: string;
  name: string;
  role: ApiUserRole;
  active: boolean;
};

export type ApiChatThread = {
  _id?: string;
  id?: string;
  name: string;
  type: "GROUP" | "PRIVATE";
  latest?: string;
  members?: string[];
  lastMessageAt?: string;
};

export type ApiChatMessage = {
  _id?: string;
  id?: string;
  body: string;
  cardType: "NONE" | "CLIENT_CARD" | "IMAGE" | "DOC" | "VOICE";
  sender: { _id?: string; id?: string; name?: string; role?: ApiUserRole } | string;
  createdAt?: string;
  metadata?: Record<string, string>;
};

export type ApiAuditEntry = {
  _id?: string;
  id?: string;
  action: string;
  recordType: string;
  recordId?: string;
  createdAt?: string;
  before?: unknown;
  after?: unknown;
  source?: "HUMAN" | "SYSTEM";
  actor?: { _id?: string; id?: string; name?: string; email?: string; role?: ApiUserRole } | string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export type BackendDashboard = {
  clients: { active: number; total: number; inProgress: number };
  invoicing: { unpaidReceivables: number; outstandingReceivables?: number; upcomingReceivables?: number };
  revenue: { activeMrr: number; history: Array<{ month: string; invoiced: number }> };
  performance: {
    score: number;
    bonusTier: string;
    components: {
      invoiceTiming: number;
      clientContact: number;
      retentionReports: number;
      complaintResolution: number;
      retention: number;
    };
  };
};

export type BackendClient = {
  _id: string;
  businessName: string;
  customerName?: string;
  email?: string;
  contactNumber?: string;
  mobileNumber?: string;
  address?: string;
  niche: string;
  cstHandler?: { _id?: string; id?: string; name?: string; role?: ApiUserRole; manager?: string | { _id?: string; id?: string } | null } | string | null;
  lifecycleStage: string;
  mrr?: number;
  workStartDate?: string;
  saleDate?: string;
  services?: string[];
  health?: number;
};

export type BackendInvoice = {
  _id: string;
  client: { _id: string; businessName: string; customerName?: string } | string;
  billingMonth: string;
  amount: number;
  dueDate: string;
  sentDate?: string | null;
  paid: boolean;
  paidDate?: string | null;
  status?: string;
};

export type BackendService = {
  _id: string;
  name: string;
  active: boolean;
};

export type BackendClientService = {
  _id: string;
  client: string;
  service: BackendService | string;
  monthlyAmount: number;
  billingType: "Recurring" | "One Time";
  active: boolean;
};

export type BackendOnboarding = {
  _id: string;
  client: { _id: string; businessName: string; customerName?: string; workStartDate?: string; lifecycleStage?: string; cstHandler?: { _id?: string; name?: string } } | string;
  calledSameDay?: boolean;
  welcomeMsgSameDay?: boolean;
  accessReceived?: boolean;
  accessItems?: { label: string; required: boolean; received: boolean }[];
  productionGoAheadAt?: string;
  delaySide?: string;
  delayReason?: string;
  onboardStatus?: string;
  highAlertSent?: boolean;
  flaggedToAsad?: boolean;
};

export type BackendContact = {
  _id: string;
  client: { _id: string; businessName: string } | string;
  contactDate: string;
  contactType: string;
  channel: string;
  notes: string;
  nextReachBackDate: string;
  createdBy?: string;
};

export type BackendComplaint = {
  _id: string;
  client: { _id: string; businessName: string } | string;
  dateRaised: string;
  details: string;
  forwardedTo?: string;
  resolved: boolean;
  dateResolved?: string;
};

export type BackendReport = {
  _id: string;
  client: { _id: string; businessName: string } | string;
  category: string;
  label: string;
  periodMonth: string;
  dueDate: string;
  dateSent?: string | null;
  status: string;
};

export type BackendUpsell = {
  _id: string;
  client: { _id: string; businessName: string } | string;
  status: string;
  servicePitched: string;
  revenue: number;
  upsellDate?: string;
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiUnavailableError extends Error {
  constructor(message = "The CRM API is unavailable") {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseEnvelope<T>(value: unknown, status: number): T {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    throw new ApiError("Malformed API response", status);
  }
  if (value.success === false) {
    const error = value as Partial<{ error: string; details: unknown }>;
    throw new ApiError(typeof error.error === "string" ? error.error : "API request failed", status, error.details);
  }
  const envelope = value as Partial<{ data: T }>;
  if (!Object.prototype.hasOwnProperty.call(envelope, "data")) {
    throw new ApiError("Malformed API response: missing data", status);
  }
  return envelope.data as T;
}

function isUnavailable(error: unknown) {
  return error instanceof TypeError
    || (error instanceof DOMException && error.name === "AbortError")
    || (error instanceof Error && error.name === "TimeoutError");
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function dashboardFromApi(value: BackendDashboard): DashboardData {
  const components = value.performance.components;
  return {
    metrics: [
      { label: "Active MRR", value: compactMoney(value.revenue.activeMrr), change: "Live from MongoDB", tone: "good" },
      { label: "Active clients", value: String(value.clients.active), change: "Current portfolio", tone: "good" },
      { label: "Receivables", value: `${compactMoney(value.invoicing.outstandingReceivables ?? value.invoicing.unpaidReceivables)} / ${compactMoney(value.invoicing.upcomingReceivables ?? 0)}`, change: "Outstanding / upcoming", tone: value.invoicing.unpaidReceivables > 0 ? "warn" : "neutral" },
      { label: "CST score", value: value.performance.score.toFixed(1), change: value.performance.bonusTier, tone: "neutral" },
    ],
    revenue: value.revenue.history.slice(-6).map((point) => ({
      month: new Date(point.month).toLocaleDateString("en-US", { month: "short" }),
      value: Math.round((point.invoiced / 1000) * 10) / 10,
    })),
    score: [
      { label: "Invoice timing", value: components.invoiceTiming, weight: 20 },
      { label: "Client contact", value: components.clientContact, weight: 25 },
      { label: "Retention reports", value: components.retentionReports, weight: 15 },
      { label: "Complaint resolution", value: components.complaintResolution, weight: 20 },
      { label: "Retention", value: components.retention, weight: 20 },
    ],
  };
}

export function clientFromApi(item: BackendClient): Client {
  const handlerObject = typeof item.cstHandler === "object" && item.cstHandler ? item.cstHandler : null;
  const handlerManager = handlerObject && typeof handlerObject.manager === "object" && handlerObject.manager ? handlerObject.manager : null;
  return {
    id: item._id,
    businessName: item.businessName,
    customerName: item.customerName ?? "",
    email: item.email ?? "",
    phone: item.contactNumber ?? "",
    mobile: item.mobileNumber ?? "",
    businessAddress: item.address ?? "",
    niche: item.niche,
    handler: handlerObject?.name ?? "Unassigned",
    handlerId: typeof item.cstHandler === "string" ? item.cstHandler : handlerObject?._id ?? handlerObject?.id,
    handlerRole: handlerObject?.role,
    handlerManagerId: typeof handlerObject?.manager === "string" ? handlerObject.manager : handlerManager?._id ?? handlerManager?.id,
    stage: (item.lifecycleStage as Client["stage"]) ?? "In Progress",
    mrr: item.mrr ?? 0,
    workStart: item.workStartDate ?? item.saleDate ?? "",
    services: item.services ?? [],
    health: item.health ?? 70,
  };
}

export function invoiceFromApi(item: BackendInvoice): Invoice {
  const clientName = typeof item.client === "object" ? item.client.businessName : "Client";
  return {
    id: item._id,
    client: clientName,
    month: item.billingMonth,
    amount: item.amount,
    due: item.dueDate ? new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
    sent: item.sentDate ? new Date(item.sentDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : undefined,
    status: (item.status as Invoice["status"]) ?? (item.paid ? "Paid" : "Not Sent"),
    paid: item.paid,
  };
}

export function activityFromApi(item: { id: string; client: string; kind: string; date: string; status: string; owner: string; detail: string; value?: number }): ActivityRecord {
  return {
    id: item.id,
    client: item.client,
    kind: item.kind,
    date: item.date ? new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
    status: (item.status as ActivityRecord["status"]) ?? "In Progress",
    owner: item.owner,
    detail: item.detail,
    value: item.value,
  };
}

function workspaceSettingsPayload(value: Partial<ApiWorkspaceSettings>): Partial<ApiWorkspaceSettings> {
  return {
    name: value.name,
    timezone: value.timezone,
    currency: value.currency,
    weekStart: value.weekStart,
    description: value.description,
    issueOffset: value.issueOffset,
    shortMonth: value.shortMonth,
    autoGeneration: value.autoGeneration,
    delayAlerts: value.delayAlerts,
    recipient: value.recipient,
    invoiceDigest: value.invoiceDigest,
    reportReminder: value.reportReminder,
  };
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...init } = options;
  const token = auth ? getAccessToken() : null;
  const requestHeaders = new Headers(headers);
  if (init.body && !requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: requestHeaders,
      signal: init.signal ?? AbortSignal.timeout(8000),
    });
  } catch (error) {
    if (isUnavailable(error)) {
      throw new ApiUnavailableError();
    }
    throw error;
  }

  if (response.status === 204) return undefined as T;
  if ([502, 503, 504].includes(response.status)) {
    throw new ApiUnavailableError();
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("API returned invalid JSON", response.status);
  }

  if (!response.ok) {
    if (auth && response.status === 401) clearSession();
    if (isRecord(payload) && payload.success === false) {
      const failure = payload as Partial<{ error: string; details: unknown }>;
      throw new ApiError(typeof failure.error === "string" ? failure.error : `API ${response.status}`, response.status, failure.details);
    }
    throw new ApiError(`API ${response.status}`, response.status);
  }

  return parseEnvelope<T>(payload, response.status);
}

export const authApi = {
  login: (email: string, password: string) => request<{ token: string; user: AuthUser }>("/auth/login", {
    auth: false,
    method: "POST",
    body: JSON.stringify({ email, password }),
  }).then((data): AuthSession => {
    const validRole = ["DIRECTOR", "CST_MANAGER", "CST_HANDLER", "CST", "SUPER_ADMIN"].includes(data?.user?.role ?? "");
    if (!data || typeof data.token !== "string" || !data.token || !data.user || typeof data.user.id !== "string" || typeof data.user.name !== "string" || typeof data.user.email !== "string" || !validRole) {
      throw new ApiError("Malformed login response", 200);
    }
    return { ...data, mode: "api" };
  }),
  me: () => request<AuthUser>("/auth/me"),
};

export const crmApi = {
  dashboard: () => request<BackendDashboard>("/dashboard").then(dashboardFromApi),
  clients: () => request<BackendClient[]>("/clients").then((items) => items.map(clientFromApi)),
  client: (id: string) => request<BackendClient>(`/clients/${id}`).then(clientFromApi),
  invoices: (params?: string) => request<BackendInvoice[]>(`/invoices${params ?? ""}`).then((items) => items.map(invoiceFromApi)),
  rawInvoices: (params?: string) => request<BackendInvoice[]>(`/invoices${params ?? ""}`),
  activities: () => request<{ id: string; client: string; kind: string; date: string; status: string; owner: string; detail: string; value?: number }[]>("/activities").then((items) => items.map(activityFromApi)),
  services: () => request<BackendService[]>("/services").then((items) => items.map((s) => s.name)),
  rawServices: () => request<BackendService[]>("/services"),
  createService: (payload: { name: string }) => request<BackendService>("/services", { method: "POST", body: JSON.stringify(payload) }),
  clientServices: (clientId: string) => request<BackendClientService[]>(`/clients/${clientId}/services`),
  createClientService: (clientId: string, payload: { service: string; monthlyAmount: number; billingType: "Recurring" | "One Time"; active?: boolean }) => request<BackendClientService>(`/clients/${clientId}/services`, { method: "POST", body: JSON.stringify(payload) }),
  create: <T>(resource: string, payload: Partial<T>) => request<T>(`/${resource}`, { method: "POST", body: JSON.stringify(payload) }),
  update: <T>(resource: string, id: string, payload: Partial<T>) => request<T>(`/${resource}/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createClient: (payload: Record<string, unknown>) => request<BackendClient>("/clients", { method: "POST", body: JSON.stringify(payload) }),
  createInvoice: (payload: Record<string, unknown>) => request<BackendInvoice>("/invoices", { method: "POST", body: JSON.stringify(payload) }),
  updateInvoice: (id: string, payload: Record<string, unknown>) => request<BackendInvoice>(`/invoices/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  workspaceSettings: () => request<ApiWorkspaceSettings>("/workspace-settings").then((settings) => workspaceSettingsPayload(settings) as ApiWorkspaceSettings),
  updateWorkspaceSettings: (payload: Partial<ApiWorkspaceSettings>) => request<ApiWorkspaceSettings>("/workspace-settings", { method: "PATCH", body: JSON.stringify(workspaceSettingsPayload(payload)) }).then((settings) => workspaceSettingsPayload(settings) as ApiWorkspaceSettings),
  jobs: () => request<ApiJobRun[]>("/system/jobs"),
  runJobs: () => request<unknown>("/system/jobs/run", { method: "POST", body: JSON.stringify({}) }),
  chatUsers: () => request<ApiChatUser[]>("/chat/users"),
  chatThreads: () => request<ApiChatThread[]>("/chat/threads"),
  createChatThread: (payload: { name: string; type: "GROUP" | "PRIVATE"; members: string[] }) => request<ApiChatThread>("/chat/threads", { method: "POST", body: JSON.stringify(payload) }),
  chatMessages: (threadId: string) => request<ApiChatMessage[]>(`/chat/threads/${threadId}/messages`),
  sendChatMessage: (threadId: string, payload: { body: string; cardType?: ApiChatMessage["cardType"]; metadata?: Record<string, string> }) => request<ApiChatMessage>(`/chat/threads/${threadId}/messages`, { method: "POST", body: JSON.stringify(payload) }),
  teamUsers: () => request<ApiTeamUser[]>("/users"),
  createTeamUser: (payload: { name: string; email: string; password: string; role: Exclude<ApiUserRole, "CST"> }) => request<ApiTeamUser>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  updateTeamUser: (id: string, payload: { name?: string; role?: Exclude<ApiUserRole, "CST">; active?: boolean; password?: string }) => request<ApiTeamUser>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }),
  assignmentClients: () => request<ApiAssignmentClient[]>("/clients?limit=100"),
  clientHistory: (id: string) => request<ApiAuditEntry[]>(`/clients/${id}/history`),
  reassignClient: (id: string, cstHandler: string) => request<ApiAssignmentClient>(`/clients/${id}/assignment`, {
    method: "PATCH",
    body: JSON.stringify({ cstHandler }),
  }),
  // Operations
  contacts: (params?: string) => request<BackendContact[]>(`/contacts${params ?? ""}`),
  createContact: (payload: Record<string, unknown>) => request<BackendContact>("/contacts", { method: "POST", body: JSON.stringify(payload) }),
  updateContact: (id: string, payload: Record<string, unknown>) => request<BackendContact>(`/contacts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  complaints: (params?: string) => request<BackendComplaint[]>(`/complaints${params ?? ""}`),
  createComplaint: (payload: Record<string, unknown>) => request<BackendComplaint>("/complaints", { method: "POST", body: JSON.stringify(payload) }),
  updateComplaint: (id: string, payload: Record<string, unknown>) => request<BackendComplaint>(`/complaints/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  reports: (params?: string) => request<BackendReport[]>(`/reports${params ?? ""}`),
  createReport: (payload: Record<string, unknown>) => request<BackendReport>("/reports", { method: "POST", body: JSON.stringify(payload) }),
  updateReport: (id: string, payload: Record<string, unknown>) => request<BackendReport>(`/reports/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  upsells: (params?: string) => request<BackendUpsell[]>(`/upsells${params ?? ""}`),
  createUpsell: (payload: Record<string, unknown>) => request<BackendUpsell>("/upsells", { method: "POST", body: JSON.stringify(payload) }),
  updateUpsell: (id: string, payload: Record<string, unknown>) => request<BackendUpsell>(`/upsells/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  // Onboarding
  onboardingList: () => request<BackendOnboarding[]>("/onboarding"),
  onboardingByClient: (clientId: string) => request<BackendOnboarding>(`/onboarding/${clientId}`),
  updateOnboarding: (clientId: string, payload: Record<string, unknown>) => request<BackendOnboarding>(`/onboarding/${clientId}`, { method: "PATCH", body: JSON.stringify(payload) }),
};
