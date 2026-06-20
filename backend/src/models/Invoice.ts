import { Schema, model } from 'mongoose';
export const invoiceStatuses = ['Not Sent', 'Sent', 'Late'] as const;
export interface IInvoice { client: Schema.Types.ObjectId; billingMonth: string; amount: number; issueDate: Date; dueDate: Date; sentDate?: Date | null; status: typeof invoiceStatuses[number]; paid: boolean; paidDate?: Date | null; }
const schema = new Schema<IInvoice>({
  client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  billingMonth: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true },
  amount: { type: Number, required: true, min: 0, immutable: true }, issueDate: { type: Date, required: true, immutable: true },
  dueDate: { type: Date, required: true, immutable: true, index: true }, sentDate: { type: Date, default: null },
  status: { type: String, enum: invoiceStatuses, default: 'Not Sent' }, paid: { type: Boolean, default: false }, paidDate: { type: Date, default: null }
}, { timestamps: true });
schema.index({ client: 1, billingMonth: 1 }, { unique: true });
schema.pre('validate', function () {
  if (this.paid && !this.paidDate) this.invalidate('paidDate', 'paidDate is required when paid');
  if (this.paid && !this.sentDate) this.invalidate('sentDate', 'sentDate is required before an invoice can be paid');
  if (this.paidDate && this.sentDate && this.paidDate < this.sentDate) this.invalidate('paidDate', 'paidDate cannot be before sentDate');
  if (!this.paid) this.paidDate = null;
});
export const Invoice = model<IInvoice>('Invoice', schema);
