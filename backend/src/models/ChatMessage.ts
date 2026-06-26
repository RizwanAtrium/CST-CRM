import { Schema, model } from 'mongoose';

export interface IChatMessage {
  thread: Schema.Types.ObjectId;
  body: string;
  cardType: 'NONE' | 'CLIENT_CARD' | 'IMAGE' | 'DOC' | 'VOICE';
  sender: Schema.Types.ObjectId;
  metadata?: Record<string, string>;
}

const schema = new Schema<IChatMessage>({
  thread: { type: Schema.Types.ObjectId, ref: 'ChatThread', required: true, index: true },
  body: { type: String, required: true, trim: true },
  cardType: { type: String, enum: ['NONE', 'CLIENT_CARD', 'IMAGE', 'DOC', 'VOICE'], default: 'NONE' },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  metadata: { type: Map, of: String, default: {} }
}, { timestamps: true });

export const ChatMessage = model<IChatMessage>('ChatMessage', schema);
