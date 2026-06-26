import { Router } from 'express';
import { z } from 'zod';
import { allowRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { WorkspaceSettings, defaultWorkspaceSettings } from '../models/WorkspaceSettings.js';
import { audit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';

const settingsBody = z.object({
  name: z.string().trim().min(1).optional(),
  timezone: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(1).optional(),
  weekStart: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  issueOffset: z.string().trim().min(1).optional(),
  shortMonth: z.string().trim().min(1).optional(),
  autoGeneration: z.string().trim().min(1).optional(),
  delayAlerts: z.string().trim().min(1).optional(),
  recipient: z.string().trim().min(1).optional(),
  invoiceDigest: z.string().trim().min(1).optional(),
  reportReminder: z.string().trim().min(1).optional()
}).strict();

export const workspaceSettingsRouter = Router();

workspaceSettingsRouter.get('/', asyncHandler(async (_req, res) => {
  const row = await WorkspaceSettings.findOne({ key: 'default' }).lean();
  res.json({ success: true, data: row ?? defaultWorkspaceSettings });
}));

workspaceSettingsRouter.patch('/',
  allowRoles('SUPER_ADMIN', 'DIRECTOR', 'CST_MANAGER'),
  validate(settingsBody),
  asyncHandler(async (req, res) => {
    const before = await WorkspaceSettings.findOne({ key: 'default' }).lean();
    const current = before ? {
      name: before.name,
      timezone: before.timezone,
      currency: before.currency,
      weekStart: before.weekStart,
      description: before.description,
      issueOffset: before.issueOffset,
      shortMonth: before.shortMonth,
      autoGeneration: before.autoGeneration,
      delayAlerts: before.delayAlerts,
      recipient: before.recipient,
      invoiceDigest: before.invoiceDigest,
      reportReminder: before.reportReminder
    } : {};
    const next = { ...defaultWorkspaceSettings, ...current, ...req.body, key: 'default' };
    const row = await WorkspaceSettings.findOneAndUpdate(
      { key: 'default' },
      { $set: next },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await audit({ actor: req.user?._id, action: 'UPDATE', recordType: 'WorkspaceSettings', recordId: 'default', before: before ?? defaultWorkspaceSettings, after: row?.toObject() });
    res.json({ success: true, data: row });
  })
);
