import { Router } from 'express';
import { z } from 'zod';
import { allowRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { RemovalRequest } from '../models/RemovalRequest.js';
import { audit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';
import { pagination } from '../utils/pagination.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i);

export const removalRequestsRouter = Router();

removalRequestsRouter.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req);
  const filter = ['SUPER_ADMIN', 'DIRECTOR'].includes(req.user?.role ?? '') ? {} : { requestedBy: req.user?._id };
  const [data, total] = await Promise.all([
    RemovalRequest.find(filter).populate('requestedBy assessedBy', 'name email role').sort({ createdAt: -1 }).skip(skip).limit(limit),
    RemovalRequest.countDocuments(filter)
  ]);
  res.json({ success: true, data, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

removalRequestsRouter.post('/', validate(z.object({
  recordType: z.string().trim().min(2).max(80),
  recordId: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(5).max(1000)
}).strict()), asyncHandler(async (req, res) => {
  const row = await RemovalRequest.create({ ...req.body, requestedBy: req.user?._id, status: 'Requested' });
  await audit({ actor: req.user?._id, action: 'REMOVAL_REQUEST_CREATED', recordType: row.recordType, recordId: row.recordId, after: row.toObject() });
  res.status(201).json({ success: true, data: row });
}));

removalRequestsRouter.patch('/:id/escalate',
  allowRoles('SUPER_ADMIN', 'DIRECTOR'),
  validate(z.object({ id: objectId }).strict(), 'params'),
  asyncHandler(async (req, res) => {
    const row = await RemovalRequest.findById(String(req.params.id));
    if (!row) throw new AppError(404, 'Removal request not found');
    row.status = 'IT Escalated';
    await row.save();
    await audit({ actor: req.user?._id, action: 'REMOVAL_REQUEST_IT_ESCALATED', recordType: row.recordType, recordId: row.recordId, after: row.toObject() });
    res.json({ success: true, data: row });
  })
);

removalRequestsRouter.patch('/:id/assess',
  allowRoles('SUPER_ADMIN', 'DIRECTOR'),
  validate(z.object({ id: objectId }).strict(), 'params'),
  validate(z.object({ decision: z.enum(['Approved', 'Rejected']), assessmentNotes: z.string().trim().min(1).max(1000) }).strict()),
  asyncHandler(async (req, res) => {
    const row = await RemovalRequest.findById(String(req.params.id));
    if (!row) throw new AppError(404, 'Removal request not found');
    row.status = req.body.decision;
    row.assessmentNotes = req.body.assessmentNotes;
    row.assessedBy = req.user?._id;
    await row.save();
    await audit({ actor: req.user?._id, action: `REMOVAL_REQUEST_${req.body.decision.toUpperCase()}`, recordType: row.recordType, recordId: row.recordId, after: row.toObject() });
    res.json({ success: true, data: row });
  })
);
