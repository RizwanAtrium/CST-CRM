import { ArrowDownRight, ArrowUpRight, ChevronRight, Inbox, LoaderCircle, Plus, RefreshCw, Search } from "lucide-react";

export function PageHeader({ eyebrow, title, description, action, secondary }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode; secondary?: React.ReactNode }) {
  return <div className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div><div className="header-actions">{secondary}{action}</div></div>;
}

export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={`button ${variant} ${className}`} {...props}>{children}</button>;
}

export function AddButton({ children, onClick, testId }: { children: React.ReactNode; onClick?: () => void; testId?: string }) {
  return <Button onClick={onClick} data-testid={testId}><Plus size={17} />{children}</Button>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "success" | "warning" | "danger" | "info" | "neutral" | "violet" }) {
  return <span className={`badge ${tone}`}><i />{children}</span>;
}

export function MetricCard({ label, value, change, tone = "good", icon }: { label: string; value: string; change: string; tone?: "good" | "warn" | "neutral"; icon: React.ReactNode }) {
  return <article className="metric-card hover-lift"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-top"><span>{label}</span><button aria-label={`View ${label}`}><ChevronRight size={16} /></button></div><strong>{value}</strong><small className={tone}>{tone === "good" ? <ArrowUpRight size={14} /> : tone === "warn" ? <ArrowDownRight size={14} /> : null}{change}</small></article>;
}

export function SearchField({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-field"><Search size={17} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

export function Avatar({ name, tone = "blue" }: { name: string; tone?: string }) {
  return <span className={`avatar ${tone}`}>{name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>;
}

export function EmptyState({ title = "Nothing here yet", description = "Records will appear here once added." }: { title?: string; description?: string }) {
  return <div className="state-card" data-testid="empty-state"><span><Inbox size={23} /></span><strong>{title}</strong><p>{description}</p></div>;
}

export function LoadingState() {
  return <div className="state-card" data-testid="loading-state"><span><LoaderCircle className="spin" size={23} /></span><strong>Loading workspace</strong><p>Fetching the latest CRM records…</p></div>;
}

export function ErrorState({ reset }: { reset?: () => void }) {
  return <div className="state-card" data-testid="error-state"><span className="error"><RefreshCw size={23} /></span><strong>Couldn’t load this view</strong><p>Check your connection and try again.</p><Button variant="secondary" onClick={reset}><RefreshCw size={16} />Try again</Button></div>;
}

export function Modal({ open, title, description, onClose, children, footer }: { open: boolean; title: string; description?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!open) return null;
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} data-testid="modal"><div className="modal-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog">×</button></div><div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</section></div>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
