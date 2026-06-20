import { SchedulerRun } from '../models/SchedulerRun.js';

export async function trackedJob<T>(job: string, key: string, fn: () => Promise<T>) {
  const existing = await SchedulerRun.findOne({ job, key });
  if (existing?.status === 'SUCCESS') return existing.summary as T;
  const run = existing ?? await SchedulerRun.create({ job, key, startedAt: new Date(), status: 'RUNNING' });
  run.startedAt = new Date(); run.status = 'RUNNING'; run.error = undefined;
  await run.save();
  try {
    const summary = await fn();
    run.status = 'SUCCESS'; run.finishedAt = new Date(); run.summary = summary;
    await run.save();
    return summary;
  } catch (error) {
    run.status = 'FAILED'; run.finishedAt = new Date(); run.error = error instanceof Error ? error.message : String(error);
    await run.save();
    throw error;
  }
}
