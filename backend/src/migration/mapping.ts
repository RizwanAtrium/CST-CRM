import type { CellValue, MigrationConfig, MigrationPlan, NormalizedClient, RawRow, RejectedRow } from './types.js';

const text = (value: CellValue) => value == null ? '' : String(value).trim();
const canonical = (value: CellValue) => text(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const optional = (row: RawRow, column?: string) => column ? text(row[column]) || undefined : undefined;
const bool = (value: CellValue) => {
  if (typeof value === 'boolean') return value;
  const normalized = canonical(value);
  return ['yes','y','true','1','done','complete','completed','received','sent'].includes(normalized);
};
const money = (value: CellValue) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const normalized = text(value).replace(/[$,\s]/g, '');
  if (!normalized) return 0;
  return Number(normalized);
};
const date = (value: CellValue) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + value * 86400000);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};
const stage = (value: CellValue, aliases: MigrationConfig['stageAliases']) => {
  const normalized = canonical(value);
  if (aliases?.[normalized]) return aliases[normalized];
  if (normalized === 'active') return 'Active';
  if (['not active','inactive','churned','lost'].includes(normalized)) return 'Not Active';
  return 'In Progress';
};
const delaySide = (value: CellValue, aliases: MigrationConfig['delayAliases']) => {
  const normalized = canonical(value);
  if (aliases?.[normalized]) return aliases[normalized];
  if (['our','ours','cst','company'].includes(normalized)) return 'Our';
  if (['client','customer'].includes(normalized)) return 'Client';
  return 'N/A';
};

export function validateMigrationConfig(config: MigrationConfig) {
  if (!config.clientSheet?.trim()) throw new Error('clientSheet is required');
  if (!config.clientColumns?.businessName || !config.clientColumns.niche || !config.clientColumns.saleDate || !config.clientColumns.workStartDate) throw new Error('clientColumns.businessName, niche, saleDate, and workStartDate are required');
  if (!Array.isArray(config.services)) throw new Error('services must be an array');
  if (!Array.isArray(config.historicalMonths) || config.historicalMonths.length === 0) throw new Error('historicalMonths is required; explicitly map every BH-CE column to YYYY-MM');
  const months = new Set<string>();
  for (const item of config.historicalMonths) {
    if (!/^\d{4}-\d{2}$/.test(item.billingMonth)) throw new Error(`Invalid billingMonth ${item.billingMonth}`);
    if (months.has(item.billingMonth)) throw new Error(`Duplicate billingMonth ${item.billingMonth}`);
    months.add(item.billingMonth);
  }
}

export function buildMigrationPlan(
  clientRows: Array<{ rowNumber: number; values: RawRow }>,
  onboardingRows: Array<{ rowNumber: number; values: RawRow }>,
  config: MigrationConfig
): MigrationPlan {
  validateMigrationConfig(config);
  const rejected: RejectedRow[] = [];
  const grouped = new Map<string, Array<{ rowNumber: number; values: RawRow }>>();
  for (const row of clientRows) {
    const key = canonical(row.values[config.clientColumns.businessName]);
    if (!key) {
      rejected.push({ sheet: config.clientSheet, row: row.rowNumber, reason: 'Missing business name' });
      continue;
    }
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }
  const duplicates = [...grouped.entries()].filter(([, rows]) => rows.length > 1).map(([canonicalName, rows]) => ({ canonicalName, rows: rows.map((row) => row.rowNumber) }));
  const clients: NormalizedClient[] = [];
  for (const [key, rows] of grouped) {
    if (rows.length > 1) {
      for (const row of rows) rejected.push({ sheet: config.clientSheet, row: row.rowNumber, reason: `Duplicate client key: ${key}`, businessName: text(row.values[config.clientColumns.businessName]) });
      continue;
    }
    const source = rows[0]!;
    const row = source.values;
    const niche = text(row[config.clientColumns.niche]);
    const saleDate = date(row[config.clientColumns.saleDate]);
    const workStartDate = date(row[config.clientColumns.workStartDate]);
    const lifecycleStage = stage(config.clientColumns.lifecycleStage ? row[config.clientColumns.lifecycleStage] : undefined, config.stageAliases);
    const dateChurned = config.clientColumns.dateChurned ? date(row[config.clientColumns.dateChurned]) : undefined;
    if (!niche) {
      rejected.push({ sheet: config.clientSheet, row: source.rowNumber, reason: 'Missing NICHE', businessName: text(row[config.clientColumns.businessName]) });
      continue;
    }
    if (!saleDate || !workStartDate) {
      rejected.push({ sheet: config.clientSheet, row: source.rowNumber, reason: 'Invalid saleDate or workStartDate', businessName: text(row[config.clientColumns.businessName]) });
      continue;
    }
    if (workStartDate < saleDate) {
      rejected.push({ sheet: config.clientSheet, row: source.rowNumber, reason: 'workStartDate precedes saleDate', businessName: text(row[config.clientColumns.businessName]) });
      continue;
    }
    if (lifecycleStage === 'Not Active' && !dateChurned) {
      rejected.push({ sheet: config.clientSheet, row: source.rowNumber, reason: 'Not Active client requires dateChurned', businessName: text(row[config.clientColumns.businessName]) });
      continue;
    }
    const serviceRows = config.services.flatMap(({ name, column }) => {
      const amount = money(row[column]);
      if (!Number.isFinite(amount) || amount < 0) {
        rejected.push({ sheet: config.clientSheet, row: source.rowNumber, reason: `Invalid service amount in ${column}`, businessName: text(row[config.clientColumns.businessName]) });
        return [];
      }
      return amount > 0 ? [{ name, monthlyAmount: amount }] : [];
    });
    const invoices = config.historicalMonths.flatMap(({ column, billingMonth }) => {
      const amount = money(row[column]);
      if (!Number.isFinite(amount) || amount < 0) {
        rejected.push({ sheet: config.clientSheet, row: source.rowNumber, reason: `Invalid historical amount in ${column}`, businessName: text(row[config.clientColumns.businessName]) });
        return [];
      }
      return amount > 0 ? [{ billingMonth, amount }] : [];
    });
    clients.push({
      sourceRow: source.rowNumber,
      businessName: text(row[config.clientColumns.businessName]),
      niche,
      customerName: optional(row, config.clientColumns.customerName),
      contactNumber: optional(row, config.clientColumns.contactNumber),
      email: optional(row, config.clientColumns.email)?.toLowerCase(),
      address: optional(row, config.clientColumns.address),
      state: optional(row, config.clientColumns.state),
      country: optional(row, config.clientColumns.country),
      closerEmail: optional(row, config.clientColumns.closerEmail)?.toLowerCase(),
      cstHandlerEmail: optional(row, config.clientColumns.cstHandlerEmail)?.toLowerCase(),
      saleDate, workStartDate, lifecycleStage, dateChurned,
      services: serviceRows,
      invoices
    });
  }

  const onboarding: MigrationPlan['onboarding'] = [];
  const acceptedNames = new Set(clients.map((client) => canonical(client.businessName)));
  if (config.onboardingSheet && config.onboardingColumns) for (const source of onboardingRows) {
    const row = source.values;
    const businessName = text(row[config.onboardingColumns.businessName]);
    if (!businessName) {
      rejected.push({ sheet: config.onboardingSheet, row: source.rowNumber, reason: 'Missing onboarding business name' });
      continue;
    }
    if (!acceptedNames.has(canonical(businessName))) {
      rejected.push({ sheet: config.onboardingSheet, row: source.rowNumber, reason: 'No accepted client match', businessName });
      continue;
    }
    const side = delaySide(config.onboardingColumns.delaySide ? row[config.onboardingColumns.delaySide] : undefined, config.delayAliases);
    const reason = optional(row, config.onboardingColumns.delayReason);
    if (side !== 'N/A' && !reason) {
      rejected.push({ sheet: config.onboardingSheet, row: source.rowNumber, reason: 'Delay reason required', businessName });
      continue;
    }
    const rawStatus = canonical(config.onboardingColumns.onboardStatus ? row[config.onboardingColumns.onboardStatus] : undefined);
    const onboardStatus = side !== 'N/A' ? 'Delayed' : rawStatus === 'completed' ? 'Completed' : rawStatus === 'in progress' ? 'In Progress' : 'Not Started';
    onboarding.push({
      sourceRow: source.rowNumber, businessName,
      calledSameDay: bool(config.onboardingColumns.calledSameDay ? row[config.onboardingColumns.calledSameDay] : undefined),
      welcomeMsgSameDay: bool(config.onboardingColumns.welcomeMsgSameDay ? row[config.onboardingColumns.welcomeMsgSameDay] : undefined),
      accessReceived: bool(config.onboardingColumns.accessReceived ? row[config.onboardingColumns.accessReceived] : undefined),
      delaySide: side, delayReason: reason, onboardStatus
    });
  }
  const totals: Record<string, number> = {};
  for (const client of clients) for (const invoice of client.invoices) totals[invoice.billingMonth] = (totals[invoice.billingMonth] ?? 0) + invoice.amount;
  return {
    clients, onboarding, rejected, duplicates,
    reconciliation: {
      clientRowsRead: clientRows.length, acceptedClients: clients.length,
      rejectedClients: rejected.filter((row) => row.sheet === config.clientSheet).length,
      onboardingRowsRead: onboardingRows.length, matchedOnboarding: onboarding.length,
      serviceLineItems: clients.reduce((sum, client) => sum + client.services.length, 0),
      invoices: clients.reduce((sum, client) => sum + client.invoices.length, 0),
      invoiceTotalsByMonth: totals
    }
  };
}
