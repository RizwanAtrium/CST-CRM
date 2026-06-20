import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

export const authRouter = Router();
authRouter.post('/login', validate(z.object({ email: z.string().email(), password: z.string().min(8) }).strict()), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase(), active: true }).select('+passwordHash');
  if (!user || !(await user.comparePassword(req.body.password))) throw new AppError(401, 'Invalid credentials');
  res.json({ success: true, data: { token: signToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
}));
authRouter.get('/me', requireAuth, (req, res) => res.json({ success: true, data: req.user }));
