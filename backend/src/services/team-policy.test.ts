import { describe, expect, it } from 'vitest';
import { canCreateRole, canManageMember, canReassignClient } from './team-policy.js';

const director = { _id: 'director', role: 'DIRECTOR' as const };
const superAdmin = { _id: 'super-admin', role: 'SUPER_ADMIN' as const };
const manager = { _id: 'manager-a', role: 'CST_MANAGER' as const };
const otherManager = { _id: 'manager-b', role: 'CST_MANAGER' as const };
const ownHandler = { _id: 'handler-a', role: 'CST_HANDLER' as const, manager: 'manager-a', active: true };
const otherHandler = { _id: 'handler-b', role: 'CST_HANDLER' as const, manager: 'manager-b', active: true };

describe('team role policy', () => {
  it('lets Super Admins create all roles and Managers only Handlers', () => {
    expect(canCreateRole(superAdmin, 'CST_MANAGER')).toBe(true);
    expect(canCreateRole(director, 'CST_MANAGER')).toBe(true);
    expect(canCreateRole(manager, 'CST_HANDLER')).toBe(true);
    expect(canCreateRole(manager, 'CST_MANAGER')).toBe(false);
  });

  it('limits Manager updates to owned Handlers', () => {
    expect(canManageMember(manager, ownHandler)).toBe(true);
    expect(canManageMember(manager, otherHandler)).toBe(false);
    expect(canManageMember(superAdmin, otherHandler)).toBe(true);
    expect(canManageMember(director, otherHandler)).toBe(true);
  });

  it('limits Manager reassignment to active Handlers on the same team', () => {
    expect(canReassignClient(manager, ownHandler, null)).toBe(true);
    expect(canReassignClient(manager, ownHandler, ownHandler)).toBe(true);
    expect(canReassignClient(manager, otherHandler, ownHandler)).toBe(false);
    expect(canReassignClient(manager, ownHandler, otherHandler)).toBe(false);
    expect(canReassignClient(otherManager, otherHandler, ownHandler)).toBe(false);
    expect(canReassignClient(manager, { ...ownHandler, active: false }, null)).toBe(false);
    expect(canReassignClient(director, { _id: 'legacy', role: 'CST', active: true }, null)).toBe(true);
    expect(canReassignClient(superAdmin, { _id: 'legacy', role: 'CST', active: true }, null)).toBe(true);
  });
});
