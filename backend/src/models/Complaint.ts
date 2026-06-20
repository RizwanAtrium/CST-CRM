import { Schema, model } from 'mongoose';
export interface IComplaint { client: Schema.Types.ObjectId; dateRaised: Date; details: string; forwardedTo?: string; dateResolved?: Date | null; resolved: boolean; createdBy: Schema.Types.ObjectId; }
const schema = new Schema<IComplaint>({ client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true }, dateRaised: { type: Date, required: true, index: true }, details: { type: String, required: true }, forwardedTo: String, dateResolved: { type: Date, default: null }, resolved: { type: Boolean, default: false, index: true }, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true });
schema.pre('validate', function () { if (this.resolved && !this.dateResolved) this.invalidate('dateResolved', 'dateResolved is required when resolved'); if (!this.resolved) this.dateResolved = null; });
export const Complaint = model<IComplaint>('Complaint', schema);
