import { activities, clients, dashboard, invoices, services } from "./demo-data";
import { clearSession, getAccessToken, getSession, type AuthSession, type AuthUser } from "./auth";
import type { ActivityRecord, Client, DashboardData, Invoice } from "./types";

export type ApiUserRole = "DIRECTOR" | "CST_MANAGER" | "CST_HANDLER" | "CST";
export type ApiTeamUser = {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: ApiUserRole;
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

type ApiEnvelope<T> = {
  success: true;
  data: T;
  meta?: unknown;
};

type ApiErrorEnvelope = {
  success: false;
  error: string;
  details?: unknown;
};

type BackendDashboard = {
  clients: { active: number };
  invoicing: { unpaidReceivables: number };
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
    const error = value as Partial<ApiErrorEnvelope>;
    throw new ApiError(typeof error.error === "string" ? error.error : "API request failed", status, error.details);
  }
  const envelope = value as Partial<ApiEnvelope<T>>;
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

function dashboardFromApi(value: BackendDashboard): DashboardData {
  const components = value.performance.components;
  return {
    metrics: [
      { label: "Active MRR", value: compactMoney(value.revenue.activeMrr), change: "Live from MongoDB", tone: "good" },
      { label: "Active clients", value: String(value.clients.active), change: "Current portfolio", tone: "good" },
      { label: "Receivables", value: compactMoney(value.invoicing.unpaidReceivables), change: "Outstanding", tone: value.invoicing.unpaidReceivables > 0 ? "warn" : "neutral" },
      { label: "CST score", value: value.performance.score.toFixed(1), change: value.performance.bonusTier, tone: "neutral" },
    ],
    revenue: value.revenue.history.slice(-6).map((point) => ({
      month: new Date(point.month).toLocaleDateString("en-US", { month: "short" }),
      value: Math.round((point.invoiced / 1000) * 10) / 10,
    })),
    score: [
      { label: "Invoice timing", value: components.invoiceTiming, weight: 20 },
      { label: "Client contact", value: components.clientContact, weight: 25 },
      { label: "Retention reports", value: components.retentionReports, weight: 20 },
      { label: "Complaint resolution", value: components.complaintResolution, weight: 20 },
      { label: "Retention", value: components.retention, weight: 15 },
    ],
  };
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean; fallback?: T } = {},
): Promise<T> {
  const { auth = true, fallback, headers, ...init } = options;
  if (auth && fallback !== undefined && getSession()?.mode === "demo") return fallback;
  const token = auth ? getAccessToken() : null;
  const requestHeaders = new Headers(headers);
  if (init.body && !requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: requestHeaders,
      signal: init.signal ?? AbortSignal.timeout(4000),
    });
  } catch (error) {
    if (isUnavailable(error)) {
      if (fallback !== undefined) return fallback;
      throw new ApiUnavailableError();
    }
    throw error;
  }

  if (response.status === 204) return undefined as T;
  if ([502, 503, 504].includes(response.status)) {
    if (fallback !== undefined) return fallback;
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
      const failure = payload as Partial<ApiErrorEnvelope>;
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
    const validRole = ["DIRECTOR", "CST_MANAGER", "CST_HANDLER", "CST"].includes(data?.user?.role ?? "");
    if (!data || typeof data.token !== "string" || !data.token || !data.user || typeof data.user.id !== "string" || typeof data.user.name !== "string" || typeof data.user.email !== "string" || !validRole) {
      throw new ApiError("Malformed login response", 200);
    }
    return { ...data, mode: "api" };
  }),
  me: () => request<AuthUser>("/auth/me"),
};

export const crmApi = {
  dashboard: () => request<BackendDashboard>("/dashboard").then(dashboardFromApi).catch((error) => {
    if (error instanceof ApiUnavailableError) return dashboard;
    throw error;
  }),
  clients: () => request<Client[]>("/clients", { fallback: clients }),
  invoices: () => request<Invoice[]>("/invoices", { fallback: invoices }),
  activities: () => request<ActivityRecord[]>("/activities", { fallback: activities }),
  services: () => request<string[]>("/services", { fallback: services }),
  create: <T>(resource: string, payload: Partial<T>) => request<T>(`/${resource}`, { method: "POST", body: JSON.stringify(payload) }),
  teamUsers: (fallback: ApiTeamUser[]) => request<ApiTeamUser[]>("/users", { fallback }),
  createTeamUser: (payload: { name: string; email: string; password: string; role: Exclude<ApiUserRole, "CST"> }, fallback: ApiTeamUser) => request<ApiTeamUser>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
    fallback,
  }),
  updateTeamUser: (id: string, payload: { name?: string; role?: Exclude<ApiUserRole, "CST">; active?: boolean; password?: string }, fallback: ApiTeamUser) => request<ApiTeamUser>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    fallback,
  }),
  assignmentClients: (fallback: ApiAssignmentClient[]) => request<ApiAssignmentClient[]>("/clients?limit=100", { fallback }),
  reassignClient: (id: string, cstHandler: string, fallback: ApiAssignmentClient) => request<ApiAssignmentClient>(`/clients/${id}/assignment`, {
    method: "PATCH",
    body: JSON.stringify({ cstHandler }),
    fallback,
  }),
};
