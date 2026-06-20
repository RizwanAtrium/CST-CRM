import bcrypt from 'bcryptjs';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export type UserRole = 'DIRECTOR' | 'CST_MANAGER' | 'CST_HANDLER' | 'CST';
export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  manager?: Types.ObjectId | null;
  active: boolean;
  comparePassword(value: string): Promise<boolean>;
}

const hidePasswordHash = (_doc: unknown, value: Record<string, unknown>) => {
  delete value.passwordHash;
  return value;
};

const schema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['DIRECTOR', 'CST_MANAGER', 'CST_HANDLER', 'CST'], required: true, default: 'CST_HANDLER' },
  manager: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  active: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { transform: hidePasswordHash },
  toObject: { transform: hidePasswordHash }
});

schema.methods.comparePassword = function (value: string) { return bcrypt.compare(value, this.passwordHash); };
export const User = model<IUser>('User', schema);
export type UserDocument = HydratedDocument<IUser>;
