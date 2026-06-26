import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { ChatThread } from '../models/ChatThread.js';
import { User } from '../models/User.js';
import { ensureStandingGroups } from '../services/chat-groups.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';
import { isSuperAdmin, isTeamManager, visibleHandlerIds } from '../services/visibility.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
const threadParams = z.object({ id: objectId }).strict();
const threadBody = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['GROUP', 'PRIVATE']).default('PRIVATE'),
  members: z.array(objectId).max(50).default([])
}).strict();
const messageBody = z.object({
  body: z.string().trim().min(1),
  cardType: z.enum(['NONE', 'CLIENT_CARD', 'IMAGE', 'DOC', 'VOICE']).default('NONE'),
  metadata: z.record(z.string(), z.string()).optional()
}).strict();

export const chatRouter = Router();

async function canUseThread(threadId: string, userId?: unknown, role?: string) {
  const filter: Record<string, unknown> = { _id: threadId };
  if (!isSuperAdmin(role)) filter.$or = [{ type: 'GROUP' }, { members: userId }];
  const thread = await ChatThread.findOne(filter);
  if (!thread) throw new AppError(404, 'Chat thread not found');
  return thread;
}

chatRouter.get('/users', asyncHandler(async (req, res) => {
  const scoped = await visibleHandlerIds(req.user);
  const filter: Record<string, unknown> = { active: true };
  if (scoped !== null) {
    const allowed = isTeamManager(req.user?.role) ? scoped : [req.user?._id];
    filter._id = { $in: allowed };
  }
  const users = await User.find(filter).select('name email role active').sort({ name: 1 }).lean();
  res.json({ success: true, data: users });
}));

chatRouter.get('/threads', asyncHandler(async (req, res) => {
  await ensureStandingGroups();
  const filter = isSuperAdmin(req.user?.role) ? {} : { $or: [{ type: 'GROUP' }, { members: req.user?._id }] };
  const rows = await ChatThread.find(filter).sort({ lastMessageAt: -1, updatedAt: -1 }).lean();
  res.json({ success: true, data: rows });
}));

chatRouter.post('/threads', validate(threadBody), asyncHandler(async (req, res) => {
  const members = Array.from(new Set([String(req.user?._id), ...req.body.members]));
  const row = await ChatThread.create({ name: req.body.name, type: req.body.type, members, latest: '', lastMessageAt: new Date() });
  res.status(201).json({ success: true, data: row });
}));

chatRouter.get('/threads/:id/messages', validate(threadParams, 'params'), asyncHandler(async (req, res) => {
  await canUseThread(String(req.params.id), req.user?._id, req.user?.role);
  const rows = await ChatMessage.find({ thread: String(req.params.id) }).populate('sender', 'name role').sort({ createdAt: 1 }).limit(200).lean();
  res.json({ success: true, data: rows });
}));

chatRouter.post('/threads/:id/messages',
  validate(threadParams, 'params'),
  validate(messageBody),
  asyncHandler(async (req, res) => {
    const thread = await canUseThread(String(req.params.id), req.user?._id, req.user?.role);
    const row = await ChatMessage.create({ ...req.body, thread: thread._id, sender: req.user?._id });
    thread.latest = row.body;
    thread.lastMessageAt = new Date();
    await thread.save();
    await row.populate('sender', 'name role');
    res.status(201).json({ success: true, data: row });
  })
);
