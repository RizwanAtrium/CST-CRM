import type {
  ActivityRecord,
  Client,
  ClientComplaint,
  ClientContact,
  ClientReport,
  ClientUpsell,
  DashboardData,
  Invoice,
  OnboardingRecord,
} from "./types";

export const clients: Client[] = [
  { id: "CL-1001", businessName: "Northstar Dental", customerName: "Maya Thompson", email: "maya@northstardental.com", phone: "+1 404 555 0132", handler: "Arham", stage: "Active", mrr: 4850, workStart: "2026-01-12", services: ["SEO", "Google Ads", "GMB"], health: 94 },
  { id: "CL-1002", businessName: "Copper & Pine", customerName: "Daniel Ross", email: "daniel@copperpine.co", phone: "+1 702 555 0181", handler: "Hira", stage: "In Progress", mrr: 3200, workStart: "2026-06-03", services: ["Website", "Brand Guidelines"], health: 82 },
  { id: "CL-1003", businessName: "Atlas Legal Group", customerName: "Farah Malik", email: "farah@atlaslegal.com", phone: "+1 312 555 0146", handler: "Arham", stage: "Active", mrr: 6200, workStart: "2025-11-21", services: ["SEO", "Facebook", "Ads Mgmt"], health: 76 },
  { id: "CL-1004", businessName: "Kindred Home Care", customerName: "Olivia Stone", email: "olivia@kindredcare.com", phone: "+1 214 555 0108", handler: "Sameer", stage: "Active", mrr: 3950, workStart: "2026-02-08", services: ["Instagram", "TikTok", "Video Editing"], health: 89 },
  { id: "CL-1005", businessName: "Vela Fitness", customerName: "Andre Lewis", email: "andre@velafit.com", phone: "+1 646 555 0194", handler: "Hira", stage: "In Progress", mrr: 2700, workStart: "2026-06-11", services: ["Logo/Design", "Instagram"], health: 68 },
  { id: "CL-1006", businessName: "Summit Roofing", customerName: "Cole Anderson", email: "cole@summitroofing.com", phone: "+1 503 555 0177", handler: "Sameer", stage: "Not Active", mrr: 0, workStart: "2025-08-14", services: ["Website", "Google Ads"], health: 42 },
  { id: "CL-1007", businessName: "Bloom Pediatrics", customerName: "Dr. Nora Reed", email: "nora@bloompeds.com", phone: "+1 617 555 0162", handler: "Arham", stage: "Active", mrr: 5100, workStart: "2025-12-03", services: ["SEO", "GMB", "Community Mgmt"], health: 97 },
  { id: "CL-1008", businessName: "Hearthstone Realty", customerName: "Ethan Cole", email: "ethan@hearthstonerealty.com", phone: "+1 305 555 0129", handler: "Hira", stage: "Active", mrr: 4500, workStart: "2026-03-17", services: ["Facebook", "Instagram", "Video Editing"], health: 71 },
  { id: "CL-1009", businessName: "Oak & Ember", customerName: "Sarah Lane", email: "sarah@oakember.co", phone: "+1 415 555 0188", handler: "Arham", stage: "In Progress", mrr: 2900, workStart: "2026-06-18", services: ["Website", "SEO"], health: 55 },
  { id: "CL-1010", businessName: "Juniper Health", customerName: "Zara Ali", email: "zara@juniperhealth.com", phone: "+1 713 555 0121", handler: "Hira", stage: "In Progress", mrr: 3600, workStart: "2026-05-24", services: ["GMB", "Google Ads"], health: 92 },
  { id: "CL-1011", businessName: "Apex Kitchens", customerName: "Noah King", email: "noah@apexkitchens.com", phone: "+1 206 555 0174", handler: "Sameer", stage: "In Progress", mrr: 4100, workStart: "2026-05-26", services: ["Website", "Instagram"], health: 88 },
  { id: "CL-1012", businessName: "Brightside Orthodontics", customerName: "Liam Hart", email: "liam@brightsideortho.com", phone: "+1 617 555 0186", handler: "Arham", stage: "In Progress", mrr: 5300, workStart: "2026-05-22", services: ["SEO", "GMB", "Google Ads"], health: 96 },
];

export const invoices: Invoice[] = [
  { id: "INV-2606-084", client: "Northstar Dental", month: "Jun 2026", amount: 4850, due: "Jun 12", sent: "Jun 5", status: "Paid", paid: true },
  { id: "INV-2606-085", client: "Atlas Legal Group", month: "Jun 2026", amount: 6200, due: "Jun 21", sent: "Jun 18", status: "Sent", paid: false },
  { id: "INV-2606-086", client: "Kindred Home Care", month: "Jun 2026", amount: 3950, due: "Jun 8", sent: "Jun 9", status: "Late", paid: false },
  { id: "INV-2606-087", client: "Bloom Pediatrics", month: "Jun 2026", amount: 5100, due: "Jun 3", sent: "May 28", status: "Paid", paid: true },
  { id: "INV-2606-088", client: "Hearthstone Realty", month: "Jun 2026", amount: 4500, due: "Jun 17", status: "Not Sent", paid: false },
  { id: "INV-2605-076", client: "Northstar Dental", month: "May 2026", amount: 4850, due: "May 12", sent: "May 5", status: "Paid", paid: true },
];

export const activities: ActivityRecord[] = [
  { id: "A-01", client: "Northstar Dental", kind: "Contact", date: "Today, 10:42", status: "Resolved", owner: "Arham", detail: "Monthly strategy call completed" },
  { id: "A-02", client: "Atlas Legal Group", kind: "Complaint", date: "Today, 09:18", status: "Open", owner: "Arham", detail: "Landing page tracking mismatch" },
  { id: "A-03", client: "Kindred Home Care", kind: "Report", date: "Yesterday", status: "Sent", owner: "Sameer", detail: "Retention Report 1 delivered" },
  { id: "A-04", client: "Copper & Pine", kind: "Onboarding", date: "Yesterday", status: "In Progress", owner: "Hira", detail: "Access received · Week 1 next" },
  { id: "A-05", client: "Bloom Pediatrics", kind: "Upsell", date: "Jun 18", status: "Converted", owner: "Arham", detail: "Community Management", value: 1200 },
];

export const dashboard: DashboardData = {
  metrics: [
    { label: "Active MRR", value: "$28.6K", change: "+8.4%", tone: "good" },
    { label: "Active clients", value: "47", change: "+4 this month", tone: "good" },
    { label: "Receivables", value: "$14.7K", change: "5 outstanding", tone: "warn" },
    { label: "CST score", value: "86.4", change: "Partial bonus", tone: "neutral" },
  ],
  revenue: [
    { month: "Jan", value: 18 }, { month: "Feb", value: 21 }, { month: "Mar", value: 20 }, { month: "Apr", value: 24 }, { month: "May", value: 26 }, { month: "Jun", value: 31 },
  ],
  score: [
    { label: "Invoice timing", value: 92, weight: 20 },
    { label: "Client contact", value: 84, weight: 25 },
    { label: "Retention reports", value: 88, weight: 20 },
    { label: "Complaint resolution", value: 79, weight: 20 },
    { label: "Retention", value: 91, weight: 15 },
  ],
};

export const services = ["Website", "GMB", "TikTok", "Facebook", "Instagram", "SEO", "Logo/Design", "Video Editing", "Brand Guidelines", "LinkedIn", "YouTube Opt", "Community Mgmt", "Ads Mgmt", "Google Ads"];

export function getDemoClient(id: string): Client {
  return clients.find((client) => client.id === id) ?? {
    id,
    businessName: "Imported client",
    customerName: "Primary contact",
    email: "contact@client.example",
    phone: "+1 000 000 0000",
    handler: "Unassigned",
    stage: "In Progress",
    mrr: 0,
    workStart: "2026-06-20",
    services: [],
    health: 70,
  };
}

export function getDemoInvoice(id: string): Invoice {
  return invoices.find((invoice) => invoice.id === id) ?? {
    id,
    client: "Imported client",
    month: "Jun 2026",
    amount: 0,
    due: "Jun 30",
    status: "Not Sent",
    paid: false,
  };
}

export function getClientInvoices(client: Client): Invoice[] {
  const existing = invoices.filter((invoice) => invoice.client === client.businessName);
  if (existing.length) return existing;
  return [
    { id: `INV-2606-${client.id.slice(-3)}`, client: client.businessName, month: "Jun 2026", amount: client.mrr, due: "Jun 28", sent: client.stage === "Active" ? "Jun 20" : undefined, status: client.stage === "Active" ? "Sent" : "Not Sent", paid: false },
    { id: `INV-2605-${client.id.slice(-3)}`, client: client.businessName, month: "May 2026", amount: client.mrr, due: "May 28", sent: "May 20", status: "Paid", paid: true },
  ];
}

export function getClientContacts(client: Client): ClientContact[] {
  return [
    { id: `CT-${client.id}-1`, date: "Jun 20, 2026", channel: "Video meeting", notes: "Monthly strategy review and next actions agreed.", owner: client.handler },
    { id: `CT-${client.id}-2`, date: "Jun 18, 2026", channel: "WhatsApp", notes: "Campaign performance check-in.", owner: client.handler },
    { id: `CT-${client.id}-3`, date: "Jun 16, 2026", channel: "Email", notes: "Weekly progress summary delivered.", owner: client.handler },
  ];
}

export function getClientReports(client: Client): ClientReport[] {
  const category = client.stage === "In Progress" ? "Onboarding" : "Retention";
  return [
    { id: `RP-${client.id}-1`, category, label: category === "Onboarding" ? "Week 1" : "Report 1", period: "Jun 2026", status: "Sent", sent: "Jun 7" },
    { id: `RP-${client.id}-2`, category, label: category === "Onboarding" ? "Biweekly" : "Report 2", period: "Jun 2026", status: client.health < 70 ? "Late" : "Pending" },
  ];
}

export function getClientComplaints(client: Client): ClientComplaint[] {
  return client.health < 80
    ? [{ id: `CP-${client.id}-1`, raised: "Jun 14, 2026", detail: "Response-time concern on the latest campaign revision.", forwardedTo: client.handler, resolved: client.health > 65, resolvedDate: client.health > 65 ? "Jun 16, 2026" : undefined }]
    : [];
}

export function getClientUpsells(client: Client): ClientUpsell[] {
  return [
    { id: `UP-${client.id}-1`, service: client.services.includes("Video Editing") ? "YouTube Opt" : "Video Editing", status: client.health > 85 ? "Converted" : "In Progress", revenue: 1200, date: "Jun 18, 2026" },
  ];
}

export function getOnboardingRecord(client: Client): OnboardingRecord {
  const day = Math.max(0, Math.min(30, Math.floor((new Date("2026-06-20").getTime() - new Date(client.workStart).getTime()) / 86400000)));
  return {
    clientId: client.id,
    day,
    status: day >= 27 ? "Graduating this week" : day >= 14 ? "Ready for review" : "In Progress",
    calledSameDay: true,
    welcomeSameDay: true,
    accessReceived: client.health >= 65,
    delaySide: client.health < 60 ? "Our" : client.health < 70 ? "Client" : "N/A",
    delayReason: client.health < 70 ? "Required account access is still incomplete." : undefined,
    highAlertSent: client.health < 60,
    flaggedToAsad: client.health < 60,
  };
}
