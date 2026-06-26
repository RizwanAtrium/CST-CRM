import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { allowRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { audit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';
import { canCreateRole, canManageMember } from '../services/team-policy.js';

export const usersRouter = Router();
const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
const role = z.enum(['SUPER_ADMIN', 'DIRECTOR', 'CST_MANAGER', 'CST_HANDLER', 'CST']);
const password = z.string().min(8).max(128)
  .regex(/[a-z]/, 'Password requires a lowercase letter')
  .regex(/[A-Z]/, 'Password requires an uppercase letter')
  .regex(/[0-9]/, 'Password requires a number');

usersRouter.use(allowRoles('SUPER_ADMIN', 'DIRECTOR', 'CST_MANAGER'));
usersRouter.get('/', asyncHandler(async (req, res) => {
  const filter = ['SUPER_ADMIN', 'DIRECTOR'].includes(req.user?.role ?? '') ? {} : { $or: [{ _id: req.user?._id }, { manager: req.user?._id, role: { $in: ['CST_HANDLER', 'CST'] } }] };
  res.json({ success: true, data: await User.find(filter).populate('manager', 'name email role').sort({ name: 1 }) });
}));
usersRouter.post('/', validate(z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(254),
  password,
  role: role.default('CST_HANDLER'),
  manager: objectId.optional()
}).strict()), asyncHandler(async (req, res) => {
  const isDirector = ['SUPER_ADMIN', 'DIRECTOR'].includes(req.user?.role ?? '');
  if (!req.user || !canCreateRole(req.user, req.body.role)) throw new AppError(403, 'CST Managers may only create CST Handlers');

  let manager: unknown = null;
  if (req.body.role === 'CST_HANDLER') {
    manager = isDirector ? req.body.manager ?? null : req.user?._id;
    if (manager) {
      const managerUser = await User.findOne({ _id: manager, role: 'CST_MANAGER', active: true });
      if (!managerUser) throw new AppError(422, 'Handler manager must be an active CST Manager');
    }
  }

  const user = await User.create({
    name: req.body.name,
    email: req.body.email.toLowerCase(),
    passwordHash: await bcrypt.hash(req.body.password, 12),
    role: req.body.role,
    manager
  });
  await audit({ actor: req.user?._id, action: 'CREATE', recordType: 'User', recordId: user._id, after: user.toObject() });
  res.status(201).json({ success: true, data: user });
}));
usersRouter.get('/:id',validate(z.object({id:objectId}).strict(),'params'),asyncHandler(async(req,res)=>{
  const user=await User.findById(String(req.params.id));
  if(!user)throw new AppError(404,'User not found');
  if (!['SUPER_ADMIN', 'DIRECTOR'].includes(req.user?.role ?? '') && String(user._id) !== String(req.user?._id) && String(user.manager) !== String(req.user?._id)) throw new AppError(403, 'Forbidden');
  await user.populate('manager', 'name email role');
  res.json({success:true,data:user});
}));
usersRouter.patch('/:id', validate(z.object({id:objectId}).strict(),'params'), validate(z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().email().max(254).optional(),
  role: role.optional(),
  manager: objectId.nullable().optional(),
  active: z.boolean().optional(),
  password: password.optional()
}).strict()), asyncHandler(async (req, res) => {
  const existing = await User.findById(req.params.id);
  if (!existing) throw new AppError(404, 'User not found');
  const isDirector = ['SUPER_ADMIN', 'DIRECTOR'].includes(req.user?.role ?? '');
  if (!req.user || !canManageMember(req.user, existing)) throw new AppError(403, 'CST Managers may only manage their own Handlers');
  if (!isDirector && ('role' in req.body || 'manager' in req.body)) throw new AppError(403, 'CST Managers cannot change Handler ownership or role');
  if (String(existing._id) === String(req.user?._id) && req.body.active === false) throw new AppError(422, 'You cannot disable your own account');

  const update: Record<string, unknown> = { ...req.body };
  if (req.body.email) update.email = req.body.email.toLowerCase();
  if (req.body.password) { update.passwordHash = await bcrypt.hash(req.body.password, 12); delete update.password; }
  const nextRole = req.body.role ?? existing.role;
  const nextManager = 'manager' in req.body ? req.body.manager : existing.manager;
  if (nextRole === 'CST_HANDLER' && nextManager) {
    const managerUser = await User.findOne({ _id: nextManager, role: 'CST_MANAGER', active: true });
    if (!managerUser) throw new AppError(422, 'Handler manager must be an active CST Manager');
  }
  if (nextRole !== 'CST_HANDLER') update.manager = null;

  const before = existing.toObject();
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!user) throw new AppError(404, 'User not found');
  await audit({ actor: req.user?._id, action: 'UPDATE', recordType: 'User', recordId: user._id, before, after: user.toObject() });
  res.json({ success: true, data: user });
}));
