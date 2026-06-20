import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, type UserRole } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../utils/async-handler.js';

interface TokenPayload { sub: string; role: UserRole; }

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  if (!token) throw new AppError(401, 'Authentication required');
  let payload: TokenPayload;
  try { payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload; } catch { throw new AppError(401, 'Invalid or expired token'); }
  const user = await User.findById(payload.sub);
  if (!user?.active) throw new AppError(401, 'User is inactive');
  req.user = user;
  next();
});

export const allowRoles = (...roles: UserRole[]): RequestHandler => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'Forbidden'));
  next();
};

export function signToken(user: { _id: unknown; role: UserRole }) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}
