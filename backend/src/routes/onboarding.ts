import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { OnboardingChecklist } from '../models/OnboardingChecklist.js';
import { audit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

const schema = z.object({ calledSameDay: z.boolean().optional(), welcomeMsgSameDay: z.boolean().optional(), accessReceived: z.boolean().optional(), delaySide: z.enum(['Our','Client','N/A']).optional(), delayReason: z.string().trim().optional(), onboardStatus: z.enum(['Not Started','In Progress','Completed','Delayed']).optional() }).strict();
const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
export const onboardingRouter = Router();
onboardingRouter.get('/', validate(z.object({ client: objectId.optional(), status: z.enum(['Not Started','In Progress','Completed','Delayed']).optional() }).strict(), 'query'), asyncHandler(async (req,res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.client) filter.client = req.query.client;
  if (req.query.status) filter.onboardStatus = req.query.status;
  res.json({ success:true, data: await OnboardingChecklist.find(filter).populate('client','businessName customerName workStartDate lifecycleStage cstHandler') });
}));
onboardingRouter.get('/:clientId', validate(z.object({ clientId: objectId }).strict(), 'params'), asyncHandler(async (req,res) => { const row = await OnboardingChecklist.findOne({ client: String(req.params.clientId) }).populate('client'); if(!row) throw new AppError(404,'Checklist not found'); res.json({success:true,data:row}); }));
onboardingRouter.patch('/:clientId', validate(z.object({ clientId: objectId }).strict(), 'params'), validate(schema), asyncHandler(async (req,res) => { const row = await OnboardingChecklist.findOne({client:String(req.params.clientId)}); if(!row) throw new AppError(404,'Checklist not found'); const before=row.toObject(); Object.assign(row,req.body); await row.save(); await audit({actor:req.user?._id,action:'UPDATE',recordType:'OnboardingChecklist',recordId:row._id,before,after:row.toObject()}); res.json({success:true,data:row}); }));
