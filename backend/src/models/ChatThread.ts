import { Schema, model } from 'mongoose';

export interface IChatThread {
  name: string;
  type: 'GROUP' | 'PRIVATE';
  members: Schema.Types.ObjectId[];
  latest?: string;
  lastMessageAt?: Date;
}

const schema = new Schema<IChatThread>({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['GROUP', 'PRIVATE'], required: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  latest: { type: String, default: '' },
  lastMessageAt: Date
}, { timestamps: true });

schema.index({ type: 1, members: 1, updatedAt: -1 });

export const ChatThread = model<IChatThread>('ChatThread', schema);
