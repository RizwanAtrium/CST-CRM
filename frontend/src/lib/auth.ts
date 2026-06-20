export type UserRole = "DIRECTOR" | "CST_MANAGER" | "CST_HANDLER" | "CST";

export const roleLabel = (role: UserRole) => ({
  DIRECTOR: "Director",
  CST_MANAGER: "CST Manager",
  CST_HANDLER: "CST Handler",
  CST: "CST Handler",
}[role]);

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  mode: "api" | "demo";
}

const SESSION_KEY = "cst-auth-session";
export const SESSION_EVENT = "cst-session-changed";

function isUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<AuthUser>;
  return typeof user.id === "string"
    && typeof user.name === "string"
    && typeof user.email === "string"
    && ["DIRECTOR", "CST_MANAGER", "CST_HANDLER", "CST"].includes(user.role ?? "");
}

function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<AuthSession>;
  return typeof session.token === "string"
    && session.token.length > 0
    && (session.mode === "api" || session.mode === "demo")
    && isUser(session.user);
}

function parseSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isSession(value) ? value : null;
  } catch {
    return null;
  }
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const temporary = parseSession(window.sessionStorage.getItem(SESSION_KEY));
  if (temporary) return temporary;
  return parseSession(window.localStorage.getItem(SESSION_KEY));
}

export function saveSession(session: AuthSession, remember: boolean) {
  if (typeof window === "undefined") return;
  clearSession(false);
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function clearSession(notify = true) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
  // Remove the original prototype key so old sessions cannot survive the migration.
  window.localStorage.removeItem("cst-token");
  if (notify) window.dispatchEvent(new Event(SESSION_EVENT));
}

export function getAccessToken() {
  const session = getSession();
  return session?.mode === "api" ? session.token : null;
}

export function createDemoSession(): AuthSession {
  return {
    token: "demo-session",
    mode: "demo",
    user: {
      id: "demo-director",
      name: "Asad Sheikh",
      email: "asad@thefinedudes.com",
      role: "DIRECTOR",
    },
  };
}
