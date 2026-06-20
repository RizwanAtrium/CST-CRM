import { Schema, model } from 'mongoose';
export const upsellStatuses = ['In Progress', 'Converted', 'Lost'] as const;
export interface IUpsell { client: Schema.Types.ObjectId; status: typeof upsellStatuses[number]; servicePitched: string; revenue: number; upsellDate?: Date | null; createdBy: Schema.Types.ObjectId; }
const schema = new Schema<IUpsell>({ client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true }, status: { type: String, enum: upsellStatuses, default: 'In Progress', index: true }, servicePitched: { type: String, required: true }, revenue: { type: Number, min: 0, default: 0 }, upsellDate: { type: Date, default: null, index: true }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true });
schema.pre('validate', function () { if (this.status === 'Converted' && !this.upsellDate) this.invalidate('upsellDate', 'upsellDate is required when converted'); });
export const Upsell = model<IUpsell>('Upsell', schema);
