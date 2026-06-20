import { ClientService } from '../models/ClientService.js';
import { monthsActive, nextBillingDate } from '../utils/dates.js';

export async function clientComputed(client: { _id: unknown; workStartDate: Date; dateChurned?: Date|null }) {
  const rows = await ClientService.find({ client: client._id, active: true }).populate('service', 'name').lean();
  const mrr = rows.reduce((sum, row) => sum + row.monthlyAmount, 0);
  const now = new Date();
  const due = nextBillingDate(client.workStartDate, now);
  return { mrr, monthsActive: monthsActive(client.workStartDate, client.dateChurned), nextInvoiceDueDate: due, services: rows };
}
