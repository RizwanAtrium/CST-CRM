import { Schema, model } from 'mongoose';
export interface IContact { client: Schema.Types.ObjectId; contactDate: Date; channel: string; notes?: string; createdBy: Schema.Types.ObjectId; }
const schema = new Schema<IContact>({ client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true }, contactDate: { type: Date, required: true, index: true }, channel: { type: String, required: true, trim: true }, notes: String, createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true });
export const Contact = model<IContact>('Contact', schema);
