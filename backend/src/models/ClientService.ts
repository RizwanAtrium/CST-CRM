import { Schema, model } from 'mongoose';
export interface IClientService { client: Schema.Types.ObjectId; service: Schema.Types.ObjectId; monthlyAmount: number; active: boolean; }
const schema = new Schema<IClientService>({
  client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  service: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
  monthlyAmount: { type: Number, required: true, min: 0 }, active: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ client: 1, service: 1 }, { unique: true });
export const ClientService = model<IClientService>('ClientService', schema);
