import { Schema, model } from 'mongoose';
export interface ISchedulerRun { job: string; key: string; startedAt: Date; finishedAt?: Date; status: 'RUNNING'|'SUCCESS'|'FAILED'; summary?: unknown; error?: string; }
const schema = new Schema<ISchedulerRun>({ job: { type: String, required: true }, key: { type: String, required: true }, startedAt: { type: Date, required: true }, finishedAt: Date, status: { type: String, enum: ['RUNNING','SUCCESS','FAILED'], required: true }, summary: Schema.Types.Mixed, error: String }, { timestamps: true });
schema.index({ job: 1, key: 1 }, { unique: true });
export const SchedulerRun = model<ISchedulerRun>('SchedulerRun', schema);
