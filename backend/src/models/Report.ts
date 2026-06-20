import { Schema, model } from 'mongoose';
export const reportCategories = ['Retention', 'Onboarding'] as const;
export const reportStatuses = ['Pending', 'Sent', 'Late'] as const;
export interface IReport { client: Schema.Types.ObjectId; category: typeof reportCategories[number]; label: string; periodMonth: string; dueDate: Date; status: typeof reportStatuses[number]; dateSent?: Date | null; notes?: string; }
const schema = new Schema<IReport>({ client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true }, category: { type: String, enum: reportCategories, required: true }, label: { type: String, required: true }, periodMonth: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true }, dueDate: { type: Date, required: true }, status: { type: String, enum: reportStatuses, default: 'Pending' }, dateSent: { type: Date, default: null }, notes: String }, { timestamps: true });
schema.index({ client: 1, category: 1, label: 1, periodMonth: 1 }, { unique: true });
export const Report = model<IReport>('Report', schema);
