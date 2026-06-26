import { Schema, model, type Types } from 'mongoose';

export const lifecycleStages = ['In Progress', 'Active', 'Not Active'] as const;
export interface IClient {
  businessName: string; customerName?: string; contactNumber?: string; email?: string;
  mobileNumber?: string; address?: string; state?: string; country?: string; niche: string; closer?: Types.ObjectId;
  cstHandler?: Types.ObjectId; saleDate: Date; workStartDate?: Date | null;
  lifecycleStage: typeof lifecycleStages[number]; dateChurned?: Date | null; version: number;
  sourceSystem?: 'SALES_CRM'; sourceReference?: string; salesOpportunityId?: string;
  salesDealValue?: number; salesAmountReceived?: number; salesPaidAt?: Date;
  salesCloserName?: string; salesCloserEmail?: string;
}

const schema = new Schema<IClient>({
  businessName: { type: String, required: true, trim: true, index: true },
  customerName: { type: String, trim: true }, contactNumber: { type: String, trim: true },
  mobileNumber: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true }, address: String, state: String, country: String,
  niche: { type: String, required: true, trim: true, index: true },
  closer: { type: Schema.Types.ObjectId, ref: 'User' }, cstHandler: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  saleDate: { type: Date, required: true, index: true }, workStartDate: { type: Date, default: null, index: true },
  lifecycleStage: { type: String, enum: lifecycleStages, default: 'In Progress', index: true },
  dateChurned: { type: Date, default: null }, version: { type: Number, default: 0 },
  sourceSystem: { type: String, enum: ['SALES_CRM'] },
  sourceReference: { type: String, trim: true },
  salesOpportunityId: { type: String, trim: true },
  salesDealValue: { type: Number, min: 0 },
  salesAmountReceived: { type: Number, min: 0 },
  salesPaidAt: Date,
  salesCloserName: { type: String, trim: true },
  salesCloserEmail: { type: String, trim: true, lowercase: true }
}, { timestamps: true, optimisticConcurrency: true });

schema.index({ sourceSystem: 1, sourceReference: 1 }, { unique: true, sparse: true });

schema.pre('validate', function () {
  if (this.lifecycleStage === 'Not Active' && !this.dateChurned) this.invalidate('dateChurned', 'dateChurned is required for Not Active clients');
  if (this.lifecycleStage !== 'Not Active') this.dateChurned = null;
  if (this.lifecycleStage === 'Active' && !this.workStartDate) this.invalidate('workStartDate', 'workStartDate is required before a client can become Active');
});
export const Client = model<IClient>('Client', schema);
