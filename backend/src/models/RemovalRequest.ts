import { Schema, model, type Types } from 'mongoose';

export type RemovalStatus = 'Requested' | 'IT Escalated' | 'Approved' | 'Rejected';

export interface IRemovalRequest {
  recordType: string;
  recordId: string;
  reason: string;
  requestedBy?: Types.ObjectId;
  assessedBy?: Types.ObjectId;
  status: RemovalStatus;
  assessmentNotes?: string;
}

const schema = new Schema<IRemovalRequest>({
  recordType: { type: String, required: true, trim: true },
  recordId: { type: String, required: true, trim: true },
  reason: { type: String, required: true, trim: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  assessedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Requested', 'IT Escalated', 'Approved', 'Rejected'], default: 'Requested', index: true },
  assessmentNotes: { type: String, trim: true }
}, { timestamps: true });

schema.index({ recordType: 1, recordId: 1, status: 1 });

export const RemovalRequest = model<IRemovalRequest>('RemovalRequest', schema);
