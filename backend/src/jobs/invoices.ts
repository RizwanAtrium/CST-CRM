import { Client } from '../models/Client.js';
import { ClientService } from '../models/ClientService.js';
import { Invoice } from '../models/Invoice.js';
import { audit } from '../services/audit.js';
import { billingDate, billingMonth, invoiceDueCandidates } from '../utils/dates.js';
import { trackedJob } from './run-job.js';

export async function generateInvoices(now = new Date(), force = false) {
  const runKey = force ? `force-${now.toISOString()}` : now.toISOString().slice(0, 10);
  return trackedJob('invoices', runKey, async () => {
    const clients = await Client.find({ lifecycleStage: 'Active' }).lean();
    let created = 0, skipped = 0;
    for (const client of clients) {
      const totals = await ClientService.aggregate([{ $match: { client: client._id, active: true } }, { $group: { _id: null, amount: { $sum: '$monthlyAmount' } } }]);
      const amount = totals[0]?.amount ?? 0;
      const dueDates = force
        ? [billingDate(client.workStartDate, now.getFullYear(), now.getMonth())]
        : invoiceDueCandidates(client.workStartDate, now, 5);
      for (const dueDate of dueDates) {
        const month = billingMonth(dueDate);
        const result = await Invoice.updateOne({ client: client._id, billingMonth: month }, { $setOnInsert: { client: client._id, billingMonth: month, amount, issueDate: now, dueDate, status: 'Not Sent', paid: false } }, { upsert: true });
        if (result.upsertedCount) {
          created++;
          await audit({ action: 'INVOICE_GENERATED', recordType: 'Invoice', recordId: result.upsertedId, after: { client: client._id, month, amount, dueDate }, source: 'SYSTEM' });
        } else skipped++;
      }
    }
    return { runDate: now, created, skipped };
  });
}

export async function markLateInvoices(now = new Date()) {
  return Invoice.updateMany({ sentDate: null, dueDate: { $lt: now }, status: { $ne: 'Late' } }, { $set: { status: 'Late' } });
}
