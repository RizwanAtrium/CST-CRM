import { ClientService } from '../models/ClientService.js';
import { monthsActive, nextBillingDate } from '../utils/dates.js';

export async function clientComputed(client: { _id: unknown; workStartDate?: Date | null; dateChurned?: Date|null }) {
  const rows = await ClientService.find({ client: client._id, active: true }).populate('service', 'name').lean();
  const recurringRows = rows.filter((row) => row.billingType !== 'One Time');
  const recurringMrr = recurringRows.reduce((sum, row) => sum + row.monthlyAmount, 0);
  const oneTimeRevenue = rows.filter((row) => row.billingType === 'One Time').reduce((sum, row) => sum + row.monthlyAmount, 0);
  const due = recurringRows.length ? nextBillingDate(client.workStartDate, new Date()) : null;
  return { mrr: recurringMrr, oneTimeRevenue, totalServiceRevenue: recurringMrr + oneTimeRevenue, monthsActive: monthsActive(client.workStartDate, client.dateChurned), nextInvoiceDueDate: due, services: rows };
}
