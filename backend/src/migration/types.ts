export type CellValue = string | number | boolean | Date | null | undefined;
export type RawRow = Record<string, CellValue>;

export interface ClientColumnMap {
  businessName: string;
  customerName?: string;
  contactNumber?: string;
  email?: string;
  address?: string;
  state?: string;
  country?: string;
  closerEmail?: string;
  cstHandlerEmail?: string;
  saleDate: string;
  workStartDate: string;
  lifecycleStage?: string;
  dateChurned?: string;
}

export interface ServiceColumnMap {
  name: string;
  column: string;
}

export interface OnboardingColumnMap {
  businessName: string;
  calledSameDay?: string;
  welcomeMsgSameDay?: string;
  accessReceived?: string;
  delaySide?: string;
  delayReason?: string;
  onboardStatus?: string;
}

export interface HistoricalMonthMap {
  column: string;
  billingMonth: string;
}

export interface MigrationConfig {
  clientSheet: string;
  onboardingSheet?: string;
  headerRow?: number;
  clientColumns: ClientColumnMap;
  services: ServiceColumnMap[];
  onboardingColumns?: OnboardingColumnMap;
  historicalMonths: HistoricalMonthMap[];
  autoColumnPatterns?: string[];
  stageAliases?: Record<string, 'In Progress'|'Active'|'Not Active'>;
  delayAliases?: Record<string, 'Our'|'Client'|'N/A'>;
}

export interface NormalizedClient {
  sourceRow: number;
  businessName: string;
  customerName?: string;
  contactNumber?: string;
  email?: string;
  address?: string;
  state?: string;
  country?: string;
  closerEmail?: string;
  cstHandlerEmail?: string;
  saleDate: Date;
  workStartDate: Date;
  lifecycleStage: 'In Progress'|'Active'|'Not Active';
  dateChurned?: Date;
  services: Array<{ name: string; monthlyAmount: number }>;
  invoices: Array<{ billingMonth: string; amount: number }>;
}

export interface RejectedRow {
  sheet: string;
  row: number;
  reason: string;
  businessName?: string;
}

export interface MigrationPlan {
  clients: NormalizedClient[];
  onboarding: Array<{
    sourceRow: number;
    businessName: string;
    calledSameDay: boolean;
    welcomeMsgSameDay: boolean;
    accessReceived: boolean;
    delaySide: 'Our'|'Client'|'N/A';
    delayReason?: string;
    onboardStatus: 'Not Started'|'In Progress'|'Completed'|'Delayed';
  }>;
  rejected: RejectedRow[];
  duplicates: Array<{ canonicalName: string; rows: number[] }>;
  reconciliation: {
    clientRowsRead: number;
    acceptedClients: number;
    rejectedClients: number;
    onboardingRowsRead: number;
    matchedOnboarding: number;
    serviceLineItems: number;
    invoices: number;
    invoiceTotalsByMonth: Record<string, number>;
  };
}
