"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Bell, BriefcaseBusiness, Check, ChevronDown, ClipboardCheck, ContactRound,
  CreditCard, FileText, HandCoins, LayoutDashboard, LifeBuoy, LogOut, Menu,
  MessageSquareWarning, Moon, Search, Settings, Sun, Users, X,
} from "lucide-react";
import { clients, invoices, services } from "@/lib/demo-data";
import { clearSession, getSession, roleLabel, SESSION_EVENT, type AuthUser } from "@/lib/auth";
import { Button, Modal } from "./ui";

const nav: ReadonlyArray<{ href: string; label: string; icon: typeof Search; count?: number }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/onboarding", label: "Onboarding", icon: ClipboardCheck, count: 6 },
  { href: "/invoices", label: "Invoices", icon: CreditCard, count: 5 },
  { href: "/services", label: "Services", icon: BriefcaseBusiness },
  { href: "/contacts", label: "Contacts", icon: ContactRound },
  { href: "/reports", label: "Reports", icon: FileText, count: 3 },
  { href: "/complaints", label: "Complaints", icon: MessageSquareWarning, count: 2 },
  { href: "/upsells", label: "Upsells", icon: HandCoins },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

type SearchResult = {
  href: string;
  label: string;
  description: string;
  icon: typeof Search;
};

const triggerStyle = { border: 0, background: "transparent", padding: 0, textAlign: "left" } as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cst-theme");
    const useDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", useDark);
    function syncUser() {
      setCurrentUser(getSession()?.user ?? null);
    }
    const timer = window.setTimeout(() => {
      syncUser();
      setDark(useDark);
    }, 0);
    window.addEventListener(SESSION_EVENT, syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SESSION_EVENT, syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setUserOpen(false);
        setHelpOpen(false);
        setWorkspaceOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  const searchResults = useMemo<SearchResult[]>(() => {
    const term = query.trim().toLowerCase();
    const moduleResults = nav
      .filter((item) => !term || item.label.toLowerCase().includes(term))
      .map((item) => ({ href: item.href, label: item.label, description: "Open module", icon: item.icon }));
    if (!term) return moduleResults;

    const clientResults = clients
      .filter((client) => `${client.businessName} ${client.customerName} ${client.email} ${client.id}`.toLowerCase().includes(term))
      .map((client) => ({ href: `/clients/${client.id}`, label: client.businessName, description: `${client.customerName} · ${client.id}`, icon: Users }));
    const invoiceResults = invoices
      .filter((invoice) => `${invoice.id} ${invoice.client} ${invoice.month}`.toLowerCase().includes(term))
      .map((invoice) => ({ href: `/invoices/${invoice.id}`, label: invoice.id, description: `${invoice.client} · ${invoice.month}`, icon: CreditCard }));
    const serviceResults = services
      .filter((service) => service.toLowerCase().includes(term))
      .map((service) => ({ href: `/services?search=${encodeURIComponent(service)}`, label: service, description: "Service catalog", icon: BriefcaseBusiness }));
    return [...moduleResults, ...clientResults, ...invoiceResults, ...serviceResults].slice(0, 14);
  }, [query]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("cst-theme", next ? "dark" : "light");
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
  }

  function logout() {
    clearSession();
    setUserOpen(false);
    router.replace("/login");
  }

  return (
    <div className="app-frame">
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`} data-testid="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div><strong>CST CRM</strong><span>Customer success OS</span></div>
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>
        <button className="workspace-pill" style={{ width: "100%", textAlign: "left" }} onClick={() => setWorkspaceOpen(true)} aria-label="Open workspace menu">
          <div className="avatar avatar-violet">TF</div>
          <div><strong>The Fine Dudes</strong><span>{currentUser ? `${roleLabel(currentUser.role)} workspace` : "CRM workspace"}</span></div>
          <ChevronDown size={15} />
        </button>
        <nav className="nav-list" aria-label="Primary navigation">
          <span className="nav-title">Workspace</span>
          {nav.map((item) => {
            const Icon = item.icon;
            const active = path === item.href || path.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={`nav-item ${active ? "active" : ""}`} onClick={() => setMobileOpen(false)} data-testid={`nav-${item.label.toLowerCase()}`}>
                <Icon size={18} strokeWidth={1.9} /><span>{item.label}</span>{item.count ? <em>{item.count}</em> : null}
              </Link>
            );
          })}
        </nav>
        <nav className="nav-list nav-bottom" aria-label="Support navigation">
          <span className="nav-title">Manage</span>
          <Link href="/settings" className={`nav-item ${path === "/settings" ? "active" : ""}`}><Settings size={18} /><span>Settings</span></Link>
          <button className="nav-item" onClick={() => setHelpOpen(true)}><LifeBuoy size={18} /><span>Help & support</span></button>
        </nav>
        <button className="sidebar-profile" style={{ ...triggerStyle, width: "100%" }} onClick={() => setUserOpen(true)} aria-label="Open user menu">
          <div className="avatar">{currentUser?.name.split(" ").map((part) => part[0]).slice(0, 2).join("") || "AS"}</div>
          <div><strong>{currentUser?.name || "Asad Sheikh"}</strong><span>{currentUser ? roleLabel(currentUser.role) : "Director"}</span></div>
          <ChevronDown size={15} />
        </button>
      </aside>

      {mobileOpen && <button className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="Close menu overlay" />}

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(true)} aria-label="Open menu" data-testid="mobile-menu"><Menu size={20} /></button>
          <button className="global-search" onClick={() => setSearchOpen(true)} data-testid="global-search"><Search size={17} /><span>Search clients, invoices, reports…</span><kbd>Ctrl K</kbd></button>
          <div className="topbar-actions">
            <button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme" data-testid="theme-toggle">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
            <button className="icon-button notification" onClick={() => setNotificationsOpen(true)} aria-label="Open notifications">
              <Bell size={19} />{!notificationsRead && <span />}
            </button>
            <div className="topbar-divider" />
            <button className="topbar-user" style={triggerStyle} onClick={() => setUserOpen(true)} aria-label="Open user menu">
              <div className="avatar small">{currentUser?.name.split(" ").map((part) => part[0]).slice(0, 2).join("") || "AS"}</div><div><strong>{currentUser?.name.split(" ")[0] || "Asad"}</strong><span>{currentUser ? roleLabel(currentUser.role) : "Director"}</span></div><ChevronDown size={14} />
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>

      {searchOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeSearch}>
          <div className="command-dialog" role="dialog" aria-modal="true" aria-label="Global search" onMouseDown={(event) => event.stopPropagation()} data-testid="search-dialog">
            <div className="command-input">
              <Search size={20} />
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search modules, clients, invoices, services…" />
              <button onClick={closeSearch}>ESC</button>
            </div>
            <div className="command-results">
              <span className="nav-title">{query ? "Search results" : "Quick links"}</span>
              {searchResults.map(({ href, label, description, icon: Icon }) => (
                <Link key={`${href}-${label}`} href={href} onClick={closeSearch}>
                  <Icon size={18} /><span>{label}</span><small>{description}</small>
                </Link>
              ))}
              {!searchResults.length && <div className="state-card" style={{ minHeight: 150 }}><strong>No matches</strong><p>Try a client, invoice, service, or module name.</p></div>}
            </div>
          </div>
        </div>
      )}

      <Modal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} title="Notifications" description="Items that need your attention." footer={<Button variant="secondary" onClick={() => setNotificationsRead(true)}><Check size={15} />Mark all read</Button>}>
        <div className="activity-list">
          <Link className="activity-item" href="/invoices?status=Late" onClick={() => setNotificationsOpen(false)}><span className="activity-icon"><CreditCard size={15} /></span><div><strong>Invoice overdue</strong><span>Kindred Home Care · 12 days late</span></div><time>Now</time></Link>
          <Link className="activity-item" href="/reports?status=Pending" onClick={() => setNotificationsOpen(false)}><span className="activity-icon"><FileText size={15} /></span><div><strong>Retention report due</strong><span>Atlas Legal Group · due tomorrow</span></div><time>1h</time></Link>
          <Link className="activity-item" href="/onboarding" onClick={() => setNotificationsOpen(false)}><span className="activity-icon"><MessageSquareWarning size={15} /></span><div><strong>Our-side onboarding delay</strong><span>Oak & Ember needs review</span></div><time>3h</time></Link>
        </div>
      </Modal>

      <Modal open={userOpen} onClose={() => setUserOpen(false)} title={currentUser?.name || "Asad Sheikh"} description={`${currentUser ? roleLabel(currentUser.role) : "Director"} · The Fine Dudes`}>
        <div className="nav-list">
          <Link className="nav-item" href="/settings" onClick={() => setUserOpen(false)}><Settings size={17} /><span>Account settings</span></Link>
          <Link className="nav-item" href="/settings?tab=team" onClick={() => setUserOpen(false)}><Users size={17} /><span>Team and roles</span></Link>
          <button className="nav-item" onClick={logout}><LogOut size={17} /><span>Sign out</span></button>
        </div>
      </Modal>

      <Modal open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} title="Workspace" description="The Fine Dudes customer-success operation.">
        <div className="activity-list">
          <div className="activity-item"><span className="avatar avatar-violet">TF</span><div><strong>The Fine Dudes</strong><span>Current workspace · {currentUser ? roleLabel(currentUser.role) : "Director"} access</span></div><Check size={17} color="var(--green)" /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Link className="button secondary" href="/settings" onClick={() => setWorkspaceOpen(false)}>Workspace settings</Link>
          <Link className="button secondary" href="/settings?tab=team" onClick={() => setWorkspaceOpen(false)}>Manage team</Link>
        </div>
      </Modal>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Help & support" description="Quick routes for common CST workflows.">
        <div className="command-results">
          <Link href="/clients" onClick={() => setHelpOpen(false)}><Users size={18} /><span>Add and manage clients</span><small>Client operations</small></Link>
          <Link href="/onboarding" onClick={() => setHelpOpen(false)}><ClipboardCheck size={18} /><span>Complete onboarding</span><small>0–30 day workflow</small></Link>
          <Link href="/invoices" onClick={() => setHelpOpen(false)}><CreditCard size={18} /><span>Send and collect invoices</span><small>Billing ledger</small></Link>
          <Link href="/settings" onClick={() => setHelpOpen(false)}><LifeBuoy size={18} /><span>Contact workspace admin</span><small>Settings and access</small></Link>
        </div>
      </Modal>
    </div>
  );
}
