import { Schema, model } from 'mongoose';
export interface IAuditLog { actor?: Schema.Types.ObjectId; action: string; recordType: string; recordId?: string; before?: unknown; after?: unknown; source: 'HUMAN'|'SYSTEM'; createdAt: Date; updatedAt: Date; }
const schema = new Schema<IAuditLog>({ actor: { type: Schema.Types.ObjectId, ref: 'User' }, action: { type: String, required: true }, recordType: { type: String, required: true, index: true }, recordId: String, before: Schema.Types.Mixed, after: Schema.Types.Mixed, source: { type: String, enum: ['HUMAN','SYSTEM'], required: true } }, { timestamps: true });
export const AuditLog = model<IAuditLog>('AuditLog', schema);
