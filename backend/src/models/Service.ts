import { Schema, model } from 'mongoose';
export interface IService { name: string; active: boolean; }
const schema = new Schema<IService>({ name: { type: String, required: true, unique: true, trim: true }, active: { type: Boolean, default: true } }, { timestamps: true });
export const Service = model<IService>('Service', schema);
