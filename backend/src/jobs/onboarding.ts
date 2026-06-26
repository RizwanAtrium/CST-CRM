import { Client } from '../models/Client.js';
import { OnboardingChecklist } from '../models/OnboardingChecklist.js';
import { Report } from '../models/Report.js';
import { audit } from '../services/audit.js';
import { billingDate, billingMonth } from '../utils/dates.js';
import { trackedJob } from './run-job.js';

const addDays = (d: Date, days: number) => { const x = new Date(d); x.setDate(x.getDate() + days); return x; };

export async function runOnboardingJobs(now = new Date()) {
  const key = now.toISOString().slice(0, 10);
  return trackedJob('onboarding', key, async () => {
    const clients = await Client.find({ lifecycleStage: 'In Progress' });
    let graduated = 0, reports = 0, alerts = 0;
    for (const client of clients) {
      if (!client.workStartDate) {
        const checklist = await OnboardingChecklist.findOne({ client: client._id });
        if (checklist?.delaySide === 'Our' && !checklist.highAlertSent) {
          checklist.highAlertSent = true; checklist.flaggedToAsad = true; checklist.alertDatetime = now; await checklist.save(); alerts++;
          await audit({ action: 'ONBOARDING_HIGH_ALERT', recordType: 'OnboardingChecklist', recordId: checklist._id, source: 'SYSTEM' });
        }
        continue;
      }
      const age = Math.floor((now.getTime() - client.workStartDate.getTime()) / 86400000);
      for (const [label, day] of [['Week 1', 7], ['Biweekly', 14], ['Monthly', 30]] as const) {
        if (age >= day) {
          const result = await Report.updateOne({ client: client._id, category: 'Onboarding', label, periodMonth: billingMonth(client.workStartDate) }, { $setOnInsert: { client: client._id, category: 'Onboarding', label, periodMonth: billingMonth(client.workStartDate), dueDate: addDays(client.workStartDate, day), status: now > addDays(client.workStartDate, day) ? 'Late' : 'Pending' } }, { upsert: true });
          reports += result.upsertedCount;
        }
      }
      const checklist = await OnboardingChecklist.findOne({ client: client._id });
      if (checklist?.delaySide === 'Our' && !checklist.highAlertSent) {
        checklist.highAlertSent = true; checklist.flaggedToAsad = true; checklist.alertDatetime = now; await checklist.save(); alerts++;
        await audit({ action: 'ONBOARDING_HIGH_ALERT', recordType: 'OnboardingChecklist', recordId: checklist._id, source: 'SYSTEM' });
      }
      if (age >= 30) {
        client.lifecycleStage = 'Active'; await client.save(); graduated++;
        await audit({ action: 'CLIENT_AUTO_GRADUATED', recordType: 'Client', recordId: client._id, source: 'SYSTEM' });
      }
    }
    return { graduated, reports, alerts };
  });
}

export async function generateRetentionReports(now = new Date()) {
  const month = billingMonth(now);
  const key = now.toISOString().slice(0, 10);
  return trackedJob('retention-reports', key, async () => {
    const clients = await Client.find({ lifecycleStage: 'Active' }).lean();
    let created = 0;
    for (const client of clients) for (const [label, day] of [['Report 1', 7], ['Report 2', 21]] as const) {
      const dueDate = billingDate(new Date(2000, 0, day), now.getFullYear(), now.getMonth());
      const result = await Report.updateOne({ client: client._id, category: 'Retention', label, periodMonth: month }, { $setOnInsert: { client: client._id, category: 'Retention', label, periodMonth: month, dueDate, status: now > dueDate ? 'Late' : 'Pending' } }, { upsert: true });
      created += result.upsertedCount;
    }
    return { month, created };
  });
}

export async function markLateReports(now = new Date()) {
  return Report.updateMany({ dateSent: null, dueDate: { $lt: now }, status: { $ne: 'Late' } }, { $set: { status: 'Late' } });
}
