import { Schema, model } from 'mongoose';
export const contactTypes = ['Complaint', 'Report', 'Upsell', 'Simple contact'] as const;
export const contactChannels = ['Phone', 'WhatsApp', 'Email', 'Video'] as const;
export interface IContact { client: Schema.Types.ObjectId; contactDate: Date; contactType: typeof contactTypes[number]; channel: typeof contactChannels[number]; notes: string; nextReachBackDate: Date; createdBy: Schema.Types.ObjectId; }
const schema = new Schema<IContact>({
  client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  contactDate: { type: Date, required: true, index: true },
  contactType: { type: String, enum: contactTypes, required: true },
  channel: { type: String, enum: contactChannels, required: true },
  notes: { type: String, required: true, trim: true },
  nextReachBackDate: { type: Date, required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
export const Contact = model<IContact>('Contact', schema);
