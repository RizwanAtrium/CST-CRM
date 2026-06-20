import { AppShell } from "@/components/app-shell";
import { SessionGuard } from "@/components/session-guard";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <SessionGuard><AppShell>{children}</AppShell></SessionGuard>;
}
