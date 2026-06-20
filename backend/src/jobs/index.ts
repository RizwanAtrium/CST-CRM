import cron from 'node-cron';
import { env } from '../config/env.js';
import { generateInvoices, markLateInvoices } from './invoices.js';
import { generateRetentionReports, markLateReports, runOnboardingJobs } from './onboarding.js';

export async function runAllJobs() {
  const [invoices, onboarding, retention] = await Promise.all([generateInvoices(), runOnboardingJobs(), generateRetentionReports()]);
  await Promise.all([markLateInvoices(), markLateReports()]);
  return { invoices, onboarding, retention };
}

export function scheduleJobs() {
  if (!env.CRON_ENABLED) return;
  cron.schedule('5 0 * * *', () => { void runAllJobs().catch(console.error); }, { timezone: env.APP_TIMEZONE });
}
