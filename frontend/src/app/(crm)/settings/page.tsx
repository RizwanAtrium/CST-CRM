import { SettingsView } from "@/components/settings-view";

type SettingsPageProps = { searchParams: Promise<{ tab?: string }> };

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const tabs: Record<string, string> = {
    team: "Team & roles",
    billing: "Billing rules",
    notifications: "Notifications",
    audit: "Audit & jobs",
  };
  return <SettingsView initialTab={tabs[params.tab ?? ""] ?? "Workspace"} />;
}
