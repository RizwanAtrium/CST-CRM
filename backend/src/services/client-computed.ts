import { ClientService } from '../models/ClientService.js';
import { Complaint } from '../models/Complaint.js';
import { Contact } from '../models/Contact.js';
import { Invoice } from '../models/Invoice.js';
import { OnboardingChecklist } from '../models/OnboardingChecklist.js';
import { Report } from '../models/Report.js';
import { currentWeekRange, invoiceTiming, monthsActive, nextBillingDate, startOfBusinessDay } from '../utils/dates.js';

const pct = (done: number, total: number) => total ? Math.round((done / total) * 10000) / 100 : 100;
const weightedHealth = (components: { contactCadence: number; invoiceTiming: number; complaintResolution: number; retentionReports: number; retention: number }) =>
  Math.round((
    components.contactCadence * 0.25 +
    components.invoiceTiming * 0.20 +
    components.complaintResolution * 0.20 +
    components.retentionReports * 0.15 +
    components.retention * 0.20
  ) * 100) / 100;

export async function clientComputed(client: { _id: unknown; workStartDate?: Date | null; dateChurned?: Date|null; lifecycleStage?: string }) {
  const rows = await ClientService.find({ client: client._id, active: true }).populate('service', 'name').lean();
  const recurringRows = rows.filter((row) => row.billingType !== 'One Time');
  const recurringMrr = recurringRows.reduce((sum, row) => sum + row.monthlyAmount, 0);
  const oneTimeRevenue = rows.filter((row) => row.billingType === 'One Time').reduce((sum, row) => sum + row.monthlyAmount, 0);
  const due = recurringRows.length ? nextBillingDate(client.workStartDate, new Date()) : null;
  const week = currentWeekRange();
  const [contactsThisWeek, latestContact, invoices, complaints, reports, onboarding] = await Promise.all([
    Contact.countDocuments({ client: client._id, contactDate: { $gte: week.start, $lt: week.end } }),
    Contact.findOne({ client: client._id }).sort({ contactDate: -1 }).lean(),
    Invoice.find({ client: client._id }).lean(),
    Complaint.find({ client: client._id }).lean(),
    Report.find({ client: client._id, category: 'Retention' }).lean(),
    OnboardingChecklist.findOne({ client: client._id }).lean()
  ]);

  const reachBackOnTime = !latestContact?.nextReachBackDate || startOfBusinessDay(latestContact.nextReachBackDate) >= startOfBusinessDay(new Date());
  const contactCadence = Math.min(100, Math.round((Math.min(contactsThisWeek, 3) / 3) * 70 + (reachBackOnTime ? 30 : 0)));
  const invoiceTimingScore = pct(invoices.filter((invoice) => invoice.sentDate && invoiceTiming(invoice.dueDate, invoice.sentDate) === 'Early').length, invoices.length);
  const complaintResolution = pct(complaints.filter((complaint) => complaint.resolved).length, complaints.length);
  const reportDenominator = reports.length || (client.lifecycleStage === 'Active' && monthsActive(client.workStartDate, client.dateChurned) > 0 ? 1 : 0);
  const retentionReports = pct(reports.filter((report) => report.dateSent && startOfBusinessDay(report.dateSent) <= startOfBusinessDay(report.dueDate)).length, reportDenominator);
  const activeMonths = monthsActive(client.workStartDate, client.dateChurned);
  const lifecycleBase = client.lifecycleStage === 'Not Active' ? 0 : client.lifecycleStage === 'In Progress' ? 60 : activeMonths >= 4 ? 100 : 75;
  const onboardingPenalty = onboarding?.delaySide && onboarding.delaySide !== 'N/A' ? 20 : 0;
  const retention = Math.max(0, lifecycleBase - onboardingPenalty);
  const healthComponents = { contactCadence, invoiceTiming: invoiceTimingScore, complaintResolution, retentionReports, retention };
  const health = weightedHealth(healthComponents);
  return { mrr: recurringMrr, oneTimeRevenue, totalServiceRevenue: recurringMrr + oneTimeRevenue, monthsActive: activeMonths, nextInvoiceDueDate: due, services: rows, health, healthComponents };
}
