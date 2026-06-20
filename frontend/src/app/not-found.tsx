import Link from "next/link";
export default function NotFound() { return <main className="state-card"><strong>Page not found</strong><p>This CRM view does not exist.</p><Link className="button primary" href="/dashboard">Back to dashboard</Link></main>; }
