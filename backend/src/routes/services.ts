import { Router } from 'express';
import type { PipelineStage } from 'mongoose';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { Service } from '../models/Service.js';
import { ClientService } from '../models/ClientService.js';
import { Client } from '../models/Client.js';
import type { UserDocument } from '../models/User.js';
import { audit } from '../services/audit.js';
import { visibleClientIds } from '../services/visibility.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
const idParams = z.object({ id: objectId }).strict();
async function clientVisibilityFilter(clientId: string, user: UserDocument | undefined) {
  const filter: Record<string, unknown> = { _id: clientId };
  const scopedIds = await visibleClientIds(user);
  if (scopedIds !== null) filter._id = { $in: scopedIds.filter((id) => String(id) === clientId) };
  return filter;
}

async function ensureVisibleClient(clientId: string, user: UserDocument | undefined) {
  if (!await Client.exists(await clientVisibilityFilter(clientId, user))) throw new AppError(404, 'Client not found');
}

export const servicesRouter = Router();
servicesRouter.get('/', asyncHandler(async (_req, res) => res.json({ success: true, data: await Service.find().sort({ name: 1 }) })));
servicesRouter.post('/', validate(z.object({ name: z.string().trim().min(1), active: z.boolean().default(true) }).strict()), asyncHandler(async (req, res) => { const row=await Service.create(req.body); await audit({actor:req.user?._id,action:'CREATE',recordType:'Service',recordId:row._id,after:row.toObject()}); res.status(201).json({ success: true, data: row }); }));
servicesRouter.get('/usage', asyncHandler(async (req, res) => {
  const visible = await visibleClientIds(req.user);
  const pipeline: PipelineStage[] = [
    { $match: { active: true } },
    { $lookup: { from: 'clients', localField: 'client', foreignField: '_id', as: 'client' } },
    { $unwind: '$client' }
  ];
  if (visible !== null) pipeline.push({ $match: { 'client._id': { $in: visible } } });
  pipeline.push(
    { $group: {
      _id: { service: '$service', lifecycleStage: '$client.lifecycleStage', niche: '$client.niche' },
      count: { $sum: 1 },
      revenue: { $sum: '$monthlyAmount' }
    } },
    { $group: {
      _id: '$_id.service',
      totalClients: { $sum: '$count' },
      revenue: { $sum: '$revenue' },
      rows: { $push: { lifecycleStage: '$_id.lifecycleStage', niche: '$_id.niche', count: '$count', revenue: '$revenue' } }
    } }
  );
  const rows = await ClientService.aggregate(pipeline);
  res.json({ success: true, data: rows.map((row) => ({
    service: String(row._id),
    totalClients: row.totalClients,
    revenue: row.revenue,
    rows: row.rows
  })) });
}));
servicesRouter.get('/:id', validate(idParams,'params'), asyncHandler(async (req,res)=>{const row=await Service.findById(String(req.params.id));if(!row)throw new AppError(404,'Service not found');res.json({success:true,data:row});}));
servicesRouter.patch('/:id', validate(idParams,'params'), validate(z.object({ name: z.string().trim().min(1).optional(), active: z.boolean().optional() }).strict()), asyncHandler(async (req, res) => { const row=await Service.findById(String(req.params.id)); if (!row) throw new AppError(404, 'Service not found'); const before=row.toObject();Object.assign(row,req.body);await row.save();await audit({actor:req.user?._id,action:'UPDATE',recordType:'Service',recordId:row._id,before,after:row.toObject()});res.json({ success: true, data: row }); }));

export const clientServicesRouter = Router({ mergeParams: true });
clientServicesRouter.get('/', validate(z.object({clientId:objectId}).strict(),'params'), asyncHandler(async (req, res) => {
  await ensureVisibleClient(String(req.params.clientId), req.user);
  res.json({ success: true, data: await ClientService.find({ client: String(req.params.clientId) }).populate('service') });
}));
clientServicesRouter.post('/', validate(z.object({clientId:objectId}).strict(),'params'), validate(z.object({ service: objectId, monthlyAmount: z.number().nonnegative(), billingType: z.enum(['Recurring','One Time']).default('Recurring'), active: z.boolean().default(true) }).strict()), asyncHandler(async (req, res) => {
  await ensureVisibleClient(String(req.params.clientId), req.user);
  const serviceExists = await Service.exists({ _id: req.body.service, active: true });
  if (!serviceExists) throw new AppError(422, 'Active service not found');
  const row = await ClientService.create({ ...req.body, client: String(req.params.clientId) });
  await audit({ actor: req.user?._id, action: 'CREATE', recordType: 'ClientService', recordId: row._id, after: row.toObject() });
  res.status(201).json({ success: true, data: row });
}));
clientServicesRouter.get('/:id', validate(z.object({clientId:objectId,id:objectId}).strict(),'params'), asyncHandler(async(req,res)=>{await ensureVisibleClient(String(req.params.clientId), req.user); const row=await ClientService.findOne({_id:String(req.params.id),client:String(req.params.clientId)}).populate('service');if(!row)throw new AppError(404,'Client service not found');res.json({success:true,data:row});}));
clientServicesRouter.patch('/:id', validate(z.object({clientId:objectId,id:objectId}).strict(),'params'), validate(z.object({ monthlyAmount: z.number().nonnegative().optional(), billingType: z.enum(['Recurring','One Time']).optional(), active: z.boolean().optional() }).strict()), asyncHandler(async (req, res) => {
  await ensureVisibleClient(String(req.params.clientId), req.user);
  const row = await ClientService.findOne({ _id: String(req.params.id), client: String(req.params.clientId) }); if (!row) throw new AppError(404, 'Client service not found');
  const before=row.toObject();Object.assign(row,req.body);await row.save();
  await audit({ actor: req.user?._id, action: 'UPDATE', recordType: 'ClientService', recordId: row._id, before, after: row.toObject() }); res.json({ success: true, data: row });
}));
clientServicesRouter.delete('/:id', validate(z.object({clientId:objectId,id:objectId}).strict(),'params'), asyncHandler(async (req) => {
  await ensureVisibleClient(String(req.params.clientId), req.user);
  await audit({ actor: req.user?._id, action: 'REMOVAL_REQUEST_BLOCKED', recordType: 'ClientService', recordId: String(req.params.id), after: { reason: 'Direct deletion is disabled by CST-6/CST-37/CST-38' } });
  throw new AppError(405, 'Direct deletion is disabled. Mark the service inactive or request removal from IT.');
}));
