import { describe, expect, it } from 'vitest';
import { User } from './User.js';
import bcrypt from 'bcryptjs';

describe('User serialization', () => {
  it('never exposes passwordHash', () => {
    const user = new User({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'sensitive-hash',
      role: 'CST'
    });

    expect(user.toJSON()).not.toHaveProperty('passwordHash');
    expect(user.toObject()).not.toHaveProperty('passwordHash');
  });

  it('supports Manager and Handler ownership without exposing password credentials', async () => {
    const passwordHash = await bcrypt.hash('StrongPass123', 4);
    const user = new User({
      name: 'CST Handler',
      email: 'handler@example.com',
      passwordHash,
      role: 'CST_HANDLER',
      manager: '507f1f77bcf86cd799439011'
    });

    expect(await user.comparePassword('StrongPass123')).toBe(true);
    expect(await user.comparePassword('WrongPass123')).toBe(false);
    expect(user.toJSON()).not.toHaveProperty('passwordHash');
    expect(user.role).toBe('CST_HANDLER');
    expect(String(user.manager)).toBe('507f1f77bcf86cd799439011');
  });
});
