import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { Client } from '../models/Client.js';
import { ClientService } from '../models/ClientService.js';
import { Invoice } from '../models/Invoice.js';
import { OnboardingChecklist } from '../models/OnboardingChecklist.js';
import { Service } from '../models/Service.js';
import { User } from '../models/User.js';
import { buildMigrationPlan } from '../migration/mapping.js';
import type { MigrationConfig, MigrationPlan, RawRow } from '../migration/types.js';

function args() {
  const values = process.argv.slice(2);
  const get = (name: string) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : undefined; };
  return { workbook: get('--workbook'), config: get('--config'), output: get('--output') ?? './migration-output', commit: values.includes('--commit') };
}

function value(cell: ExcelJS.Cell) {
  const raw = cell.value;
  if (raw && typeof raw === 'object' && 'result' in raw) return raw.result as string|number|boolean|Date|null;
  if (raw && typeof raw === 'object' && 'text' in raw) return raw.text;
  return raw as string|number|boolean|Date|null;
}

function readRows(sheet: ExcelJS.Worksheet, headerRow: number, autoPatterns: RegExp[]) {
  const headers = new Map<number,string>();
  sheet.getRow(headerRow).eachCell({ includeEmpty: true }, (cell, column) => {
    const header = String(value(cell) ?? '').trim();
    if (header && !autoPatterns.some((pattern) => pattern.test(header))) headers.set(column, header);
  });
  const rows: Array<{ rowNumber:number; values:RawRow }> = [];
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const values: RawRow = {};
    let populated = false;
    for (const [column, header] of headers) {
      const cellValue = value(row.getCell(column));
      values[header] = cellValue;
      if (cellValue != null && String(cellValue).trim() !== '') populated = true;
    }
    if (populated) rows.push({ rowNumber, values });
  }
  return { headers:[...headers.values()], rows };
}

async function commit(plan: MigrationPlan) {
  for (const source of plan.clients) {
    const [closer,cstHandler] = await Promise.all([
      source.closerEmail ? User.findOne({ email: source.closerEmail }).lean() : null,
      source.cstHandlerEmail ? User.findOne({ email: source.cstHandlerEmail }).lean() : null
    ]);
    if (source.closerEmail && !closer) throw new Error(`Missing closer user ${source.closerEmail}`);
    if (source.cstHandlerEmail && !cstHandler) throw new Error(`Missing CST user ${source.cstHandlerEmail}`);
    const client = await Client.findOneAndUpdate(
      { businessName: source.businessName },
      { $setOnInsert: {
        businessName: source.businessName, niche: source.niche, customerName: source.customerName, contactNumber: source.contactNumber,
        email: source.email, address: source.address, state: source.state, country: source.country,
        closer: closer?._id, cstHandler: cstHandler?._id, saleDate: source.saleDate,
        workStartDate: source.workStartDate, lifecycleStage: source.lifecycleStage, dateChurned: source.dateChurned
      } },
      { upsert:true, new:true }
    );
    for (const line of source.services) {
      const service = await Service.findOne({ name: line.name });
      if (!service) throw new Error(`Missing seeded service ${line.name}`);
      await ClientService.updateOne({ client:client._id, service:service._id }, { $setOnInsert:{ client:client._id, service:service._id, monthlyAmount:line.monthlyAmount, billingType:'Recurring', active:true } }, { upsert:true });
    }
    for (const invoice of source.invoices) {
      const year = Number(invoice.billingMonth.slice(0,4)), month = Number(invoice.billingMonth.slice(5,7)) - 1;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const dueDate = new Date(year, month, Math.min(source.workStartDate.getDate(), lastDay));
      await Invoice.updateOne({ client:client._id, billingMonth:invoice.billingMonth }, { $setOnInsert:{ client:client._id, billingMonth:invoice.billingMonth, amount:invoice.amount, issueDate:dueDate, dueDate, status:'Not Sent', paid:false } }, { upsert:true });
    }
    const checklist = plan.onboarding.find((row) => row.businessName.toLowerCase() === source.businessName.toLowerCase());
    if (checklist) await OnboardingChecklist.updateOne({ client:client._id }, { $setOnInsert:{ client:client._id, calledSameDay:checklist.calledSameDay, welcomeMsgSameDay:checklist.welcomeMsgSameDay, accessReceived:checklist.accessReceived, delaySide:checklist.delaySide, delayReason:checklist.delayReason, onboardStatus:checklist.onboardStatus } }, { upsert:true });
  }
}

async function main() {
  const options = args();
  if (!options.workbook || !options.config) throw new Error('Usage: npm run migrate:excel -- --workbook <xlsx> --config <json> [--output <dir>] [--commit]');
  const config = JSON.parse(await readFile(path.resolve(options.config),'utf8')) as MigrationConfig;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.resolve(options.workbook));
  const autoPatterns = (config.autoColumnPatterns ?? ['\\[AUTO\\]','^AUTO']).map((pattern) => new RegExp(pattern,'i'));
  const clientSheet = workbook.getWorksheet(config.clientSheet);
  if (!clientSheet) throw new Error(`Missing sheet ${config.clientSheet}`);
  const clientData = readRows(clientSheet, config.headerRow ?? 1, autoPatterns);
  const onboardingSheet = config.onboardingSheet ? workbook.getWorksheet(config.onboardingSheet) : undefined;
  if (config.onboardingSheet && !onboardingSheet) throw new Error(`Missing sheet ${config.onboardingSheet}`);
  const onboardingData = onboardingSheet ? readRows(onboardingSheet, config.headerRow ?? 1, autoPatterns) : { headers:[], rows:[] };
  const plan = buildMigrationPlan(clientData.rows,onboardingData.rows,config);
  const output = path.resolve(options.output);
  await writeFile(`${output}.profile.json`,JSON.stringify({ workbook:path.resolve(options.workbook), sheets:workbook.worksheets.map((sheet)=>({name:sheet.name,rows:sheet.rowCount,columns:sheet.columnCount})), selected:{client:{sheet:clientSheet.name,headers:clientData.headers},onboarding:onboardingSheet?{sheet:onboardingSheet.name,headers:onboardingData.headers}:null} },null,2));
  await writeFile(`${output}.plan.json`,JSON.stringify(plan,null,2));
  await writeFile(`${output}.rejected.json`,JSON.stringify(plan.rejected,null,2));
  if (options.commit) {
    if (plan.rejected.length || plan.duplicates.length) throw new Error('Commit refused: resolve all rejected/duplicate rows first');
    await connectDatabase();
    try { await commit(plan); } finally { await disconnectDatabase(); }
  }
  console.log(JSON.stringify({ mode:options.commit?'COMMIT':'DRY_RUN', outputs:[`${output}.profile.json`,`${output}.plan.json`,`${output}.rejected.json`], reconciliation:plan.reconciliation },null,2));
}

main().catch((error)=>{ console.error(error instanceof Error?error.message:error); process.exitCode=1; });
