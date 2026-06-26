import { Types } from 'mongoose';
import type { FilterQuery } from 'mongoose';
import { Client, type IClient } from '../models/Client.js';
import { User, type UserDocument } from '../models/User.js';

export const isSuperAdmin = (role?: string) => role === 'SUPER_ADMIN' || role === 'DIRECTOR';
export const isTeamManager = (role?: string) => role === 'CST_MANAGER';
export const isHandler = (role?: string) => role === 'CST_HANDLER' || role === 'CST';

export async function visibleHandlerIds(user?: UserDocument | null) {
  if (!user) return [];
  if (isSuperAdmin(user.role)) return null;
  if (isTeamManager(user.role)) {
    const handlers = await User.find({ manager: user._id, role: { $in: ['CST_HANDLER', 'CST'] }, active: true }).select('_id').lean();
    return [user._id as Types.ObjectId, ...handlers.map((handler) => handler._id)];
  }
  if (isHandler(user.role)) return [user._id as Types.ObjectId];
  return [];
}

export async function applyClientVisibility(filter: Record<string, unknown>, user?: UserDocument | null) {
  const ids = await visibleHandlerIds(user);
  if (ids === null) return filter;
  filter.cstHandler = { $in: ids };
  return filter;
}

export async function visibleClientIds(user?: UserDocument | null) {
  const ids = await visibleHandlerIds(user);
  if (ids === null) return null;
  const clients = await Client.find({ cstHandler: { $in: ids } }).select('_id').lean();
  return clients.map((client) => client._id);
}

export async function scopedClientFilter(user?: UserDocument | null): Promise<FilterQuery<IClient>> {
  const ids = await visibleHandlerIds(user);
  return ids === null ? {} : { cstHandler: { $in: ids } };
}
