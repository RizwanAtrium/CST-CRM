import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { Service } from '../models/Service.js';
import { ClientService } from '../models/ClientService.js';
import { Client } from '../models/Client.js';
import { audit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
const idParams = z.object({ id: objectId }).strict();
export const servicesRouter = Router();
servicesRouter.get('/', asyncHandler(async (_req, res) => res.json({ success: true, data: await Service.find().sort({ name: 1 }) })));
servicesRouter.post('/', validate(z.object({ name: z.string().trim().min(1), active: z.boolean().default(true) }).strict()), asyncHandler(async (req, res) => { const row=await Service.create(req.body); await audit({actor:req.user?._id,action:'CREATE',recordType:'Service',recordId:row._id,after:row.toObject()}); res.status(201).json({ success: true, data: row }); }));
servicesRouter.get('/:id', validate(idParams,'params'), asyncHandler(async (req,res)=>{const row=await Service.findById(String(req.params.id));if(!row)throw new AppError(404,'Service not found');res.json({success:true,data:row});}));
servicesRouter.patch('/:id', validate(idParams,'params'), validate(z.object({ name: z.string().trim().min(1).optional(), active: z.boolean().optional() }).strict()), asyncHandler(async (req, res) => { const row=await Service.findById(String(req.params.id)); if (!row) throw new AppError(404, 'Service not found'); const before=row.toObject();Object.assign(row,req.body);await row.save();await audit({actor:req.user?._id,action:'UPDATE',recordType:'Service',recordId:row._id,before,after:row.toObject()});res.json({ success: true, data: row }); }));

export const clientServicesRouter = Router({ mergeParams: true });
clientServicesRouter.get('/', validate(z.object({clientId:objectId}).strict(),'params'), asyncHandler(async (req, res) => res.json({ success: true, data: await ClientService.find({ client: String(req.params.clientId) }).populate('service') })));
clientServicesRouter.post('/', validate(z.object({clientId:objectId}).strict(),'params'), validate(z.object({ service: objectId, monthlyAmount: z.number().nonnegative(), active: z.boolean().default(true) }).strict()), asyncHandler(async (req, res) => {
  const [clientExists, serviceExists] = await Promise.all([
    Client.exists({ _id: String(req.params.clientId) }),
    Service.exists({ _id: req.body.service, active: true })
  ]);
  if (!clientExists) throw new AppError(404, 'Client not found');
  if (!serviceExists) throw new AppError(422, 'Active service not found');
  const row = await ClientService.create({ ...req.body, client: String(req.params.clientId) });
  await audit({ actor: req.user?._id, action: 'CREATE', recordType: 'ClientService', recordId: row._id, after: row.toObject() });
  res.status(201).json({ success: true, data: row });
}));
clientServicesRouter.get('/:id', validate(z.object({clientId:objectId,id:objectId}).strict(),'params'), asyncHandler(async(req,res)=>{const row=await ClientService.findOne({_id:String(req.params.id),client:String(req.params.clientId)}).populate('service');if(!row)throw new AppError(404,'Client service not found');res.json({success:true,data:row});}));
clientServicesRouter.patch('/:id', validate(z.object({clientId:objectId,id:objectId}).strict(),'params'), validate(z.object({ monthlyAmount: z.number().nonnegative().optional(), active: z.boolean().optional() }).strict()), asyncHandler(async (req, res) => {
  const row = await ClientService.findOne({ _id: String(req.params.id), client: String(req.params.clientId) }); if (!row) throw new AppError(404, 'Client service not found');
  const before=row.toObject();Object.assign(row,req.body);await row.save();
  await audit({ actor: req.user?._id, action: 'UPDATE', recordType: 'ClientService', recordId: row._id, before, after: row.toObject() }); res.json({ success: true, data: row });
}));
clientServicesRouter.delete('/:id', validate(z.object({clientId:objectId,id:objectId}).strict(),'params'), asyncHandler(async (req, res) => { const row = await ClientService.findOneAndDelete({ _id: String(req.params.id), client: String(req.params.clientId) }); if (!row) throw new AppError(404, 'Client service not found');await audit({actor:req.user?._id,action:'DELETE',recordType:'ClientService',recordId:row._id,before:row.toObject()});res.status(204).send(); }));
