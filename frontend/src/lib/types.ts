export type Stage = "Active" | "In Progress" | "Not Active";
export type Status = "Paid" | "Sent" | "Late" | "Not Sent" | "Pending" | "Resolved" | "Open" | "Converted" | "Lost";

export interface Client {
  id: string;
  businessName: string;
  customerName: string;
  email: string;
  phone: string;
  mobile?: string;
  businessAddress?: string;
  niche: string;
  handler: string;
  handlerId?: string;
  handlerRole?: string;
  handlerManagerId?: string;
  stage: Stage;
  mrr: number;
  workStart: string;
  services: string[];
  health: number;
}

export interface Invoice {
  id: string;
  client: string;
  month: string;
  amount: number;
  due: string;
  dueIso?: string;
  sent?: string;
  sentIso?: string;
  paidDateIso?: string;
  status: Status;
  paid: boolean;
}

export interface ClientContact {
  id: string;
  date: string;
  contactType: "Complaint" | "Report" | "Upsell" | "Simple contact";
  channel: "Phone" | "Email" | "WhatsApp" | "Video";
  notes: string;
  nextReachBack: string;
  owner: string;
}

export interface ClientReport {
  id: string;
  category: "Retention" | "Onboarding";
  label: string;
  period: string;
  status: "Pending" | "Sent" | "Late";
  sent?: string;
}

export interface ClientComplaint {
  id: string;
  raised: string;
  detail: string;
  forwardedTo: string;
  resolved: boolean;
  resolvedDate?: string;
}

export interface ClientUpsell {
  id: string;
  service: string;
  status: "In Progress" | "Converted" | "Lost";
  revenue: number;
  date: string;
}

export interface OnboardingRecord {
  clientId: string;
  day: number;
  status: "In Progress" | "Ready for review" | "Graduating this week";
  calledSameDay: boolean;
  welcomeSameDay: boolean;
  accessReceived: boolean;
  accessItems: { label: string; required: boolean; received: boolean }[];
  productionGoAhead?: string;
  delaySide: "Our" | "Client" | "N/A";
  delayReason?: string;
  highAlertSent: boolean;
  flaggedToAsad: boolean;
}

export interface ActivityRecord {
  id: string;
  client: string;
  kind: string;
  date: string;
  status: Status | "In Progress";
  owner: string;
  detail: string;
  value?: number;
}

export interface DashboardData {
  metrics: { label: string; value: string; change: string; tone: "good" | "warn" | "neutral" }[];
  revenue: { month: string; value: number }[];
  score: { label: string; value: number; weight: number }[];
}
