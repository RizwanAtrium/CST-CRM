import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { Client } from '../models/Client.js';
import { OnboardingChecklist } from '../models/OnboardingChecklist.js';
import type { UserDocument } from '../models/User.js';
import { audit } from '../services/audit.js';
import { visibleClientIds } from '../services/visibility.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

const accessItem = z.object({ label: z.string().trim().min(1), required: z.boolean().default(true), received: z.boolean().default(false), notes: z.string().trim().optional() }).strict();
const onboardStatus = z.enum(['Not Started','In Progress','Ready for review','Graduating this week','Completed','Delayed']);
const schema = z.object({ calledSameDay: z.boolean().optional(), welcomeMsgSameDay: z.boolean().optional(), accessReceived: z.boolean().optional(), accessItems: z.array(accessItem).max(100).optional(), productionGoAheadAt: z.coerce.date().nullable().optional(), delaySide: z.enum(['Our','Client','N/A']).optional(), delayReason: z.string().trim().optional(), onboardStatus: onboardStatus.optional() }).strict();
const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
export const onboardingRouter = Router();
async function applyOnboardingVisibility(filter: Record<string, unknown>, user: UserDocument | undefined, requestedClient?: string) {
  const scopedIds = await visibleClientIds(user);
  if (scopedIds === null) {
    if (requestedClient) filter.client = requestedClient;
    return filter;
  }
  filter.client = { $in: requestedClient ? scopedIds.filter((id) => String(id) === requestedClient) : scopedIds };
  return filter;
}

onboardingRouter.get('/', validate(z.object({ client: objectId.optional(), status: onboardStatus.optional() }).strict(), 'query'), asyncHandler(async (req,res) => {
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.onboardStatus = req.query.status;
  await applyOnboardingVisibility(filter, req.user, req.query.client ? String(req.query.client) : undefined);
  res.json({ success:true, data: await OnboardingChecklist.find(filter).populate('client','businessName customerName workStartDate lifecycleStage cstHandler') });
}));
onboardingRouter.get('/:clientId', validate(z.object({ clientId: objectId }).strict(), 'params'), asyncHandler(async (req,res) => { const row = await OnboardingChecklist.findOne(await applyOnboardingVisibility({}, req.user, String(req.params.clientId))).populate('client'); if(!row) throw new AppError(404,'Checklist not found'); res.json({success:true,data:row}); }));
onboardingRouter.patch('/:clientId', validate(z.object({ clientId: objectId }).strict(), 'params'), validate(schema), asyncHandler(async (req,res) => {
  const row = await OnboardingChecklist.findOne(await applyOnboardingVisibility({}, req.user, String(req.params.clientId)));
  if(!row) throw new AppError(404,'Checklist not found');
  const before=row.toObject();
  Object.assign(row,req.body);
  await row.save();
  if (row.onboardStatus === 'Completed') {
    const workStartDate = row.productionGoAheadAt ?? new Date();
    await Client.updateOne({ _id: row.client }, { $set: { lifecycleStage: 'Active', workStartDate } });
    await audit({ actor:req.user?._id, action:'IN_APP_CHAT_CARD_STAGE_CHANGED', recordType:'Client', recordId:row.client, source:'SYSTEM', after:{ group:'Active', stage:'Active', workStartDate } });
  }
  await audit({actor:req.user?._id,action:'UPDATE',recordType:'OnboardingChecklist',recordId:row._id,before,after:row.toObject()});
  res.json({success:true,data:row});
}));
