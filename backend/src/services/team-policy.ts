import type { UserRole } from '../models/User.js';

export interface TeamActor { _id: unknown; role: UserRole }
export interface TeamMember { _id: unknown; role: UserRole; manager?: unknown; active?: boolean }

const sameId = (left: unknown, right: unknown) => Boolean(left && right) && String(left) === String(right);

export const isOwnedHandler = (manager: TeamActor, member: TeamMember) =>
  manager.role === 'CST_MANAGER' && member.role === 'CST_HANDLER' && sameId(member.manager, manager._id);

export const canCreateRole = (actor: TeamActor, requestedRole: UserRole) =>
  actor.role === 'DIRECTOR' || (actor.role === 'CST_MANAGER' && requestedRole === 'CST_HANDLER');

export const canManageMember = (actor: TeamActor, member: TeamMember) =>
  actor.role === 'DIRECTOR' || isOwnedHandler(actor, member);

export const canReassignClient = (actor: TeamActor, target: TeamMember, current?: TeamMember | null) => {
  if (!target.active || !['CST_HANDLER', 'CST'].includes(target.role)) return false;
  if (actor.role === 'DIRECTOR') return true;
  if (!isOwnedHandler(actor, target)) return false;
  return !current || isOwnedHandler(actor, current);
};
