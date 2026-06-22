import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { Client } from '../models/Client.js';
import { ClientService } from '../models/ClientService.js';
import { Service } from '../models/Service.js';
import { OnboardingChecklist } from '../models/OnboardingChecklist.js';
import { Complaint } from '../models/Complaint.js';
import { Contact } from '../models/Contact.js';
import { Invoice } from '../models/Invoice.js';
import { Report } from '../models/Report.js';
import { Upsell } from '../models/Upsell.js';
import { clientComputed } from '../services/client-computed.js';
import { audit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';
import { pagination } from '../utils/pagination.js';
import { allowRoles } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { canReassignClient } from '../services/team-policy.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
const bodyShape = {
  businessName: z.string().min(1), customerName: z.string().optional(), contactNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')), address: z.string().optional(), state: z.string().optional(), country: z.string().optional(),
  closer: objectId.optional(), cstHandler: objectId.optional(), saleDate: z.coerce.date(), workStartDate: z.coerce.date(),
  lifecycleStage: z.enum(['In Progress','Active','Not Active']).default('In Progress'), dateChurned: z.coerce.date().nullable().optional()
};
const validClientDates = (value: { saleDate?: Date; workStartDate?: Date; lifecycleStage?: string; dateChurned?: Date | null }) =>
  (!value.saleDate || !value.workStartDate || value.workStartDate >= value.saleDate) &&
  (value.lifecycleStage !== 'Not Active' || value.dateChurned != null);
const serviceLine = z.object({ service: objectId, monthlyAmount: z.number().nonnegative(), active: z.boolean().default(true) }).strict();
const createBody = z.object({ ...bodyShape, services: z.array(serviceLine).max(50).default([]) }).strict()
  .refine(validClientDates, { message: 'workStartDate cannot precede saleDate and Not Active clients require dateChurned' })
  .refine((value) => new Set(value.services.map((row) => row.service)).size === value.services.length, { message: 'Duplicate client service' });

const clientFieldLabels: Record<string, string> = {
  businessName: 'Business name',
  customerName: 'Customer name',
  contactNumber: 'Phone',
  email: 'Email',
  address: 'Business address',
  cstHandler: 'CST handler',
  lifecycleStage: 'Lifecycle stage',
  dateChurned: 'Date churned',
  saleDate: 'Sale date',
  workStartDate: 'Work start date',
};
const auditDisplay = (value: unknown) => {
  if (value == null || value === '') return 'Not set';
  if (value instanceof Date) return value.toISOString();
  return String(value);
};
const collectClientChanges = (before: Record<string, unknown>, after: Record<string, unknown>, keys: string[]) => keys
  .filter((key) => auditDisplay(before[key]) !== auditDisplay(after[key]))
  .map((key) => ({ field: key, label: clientFieldLabels[key] ?? key, before: auditDisplay(before[key]), after: auditDisplay(after[key]) }));

export const clientsRouter = Router();
clientsRouter.get('/', validate(z.object({ page:z.coerce.number().int().positive().optional(), limit:z.coerce.number().int().min(1).max(100).optional(), stage:z.enum(['In Progress','Active','Not Active']).optional(), handler:objectId.optional(), search:z.string().trim().max(100).optional() }).strict(), 'query'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req);
  const filter: Record<string, unknown> = {};
  if (req.query.stage) filter.lifecycleStage = req.query.stage;
  if (req.query.handler) filter.cstHandler = req.query.handler;
  if (req.query.search) filter.$or = ['businessName','customerName','email'].map((field) => ({ [field]: { $regex: String(req.query.search), $options: 'i' } }));
  const [items, total] = await Promise.all([Client.find(filter).populate('cstHandler closer','name email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Client.countDocuments(filter)]);
  const mrr = await ClientService.aggregate([{ $match: { client: { $in: items.map((x) => x._id) }, active: true } }, { $group: { _id: '$client', value: { $sum: '$monthlyAmount' } } }]);
  const map = new Map(mrr.map((x) => [String(x._id), x.value]));
  res.json({ success: true, data: items.map((x) => ({ ...x, mrr: map.get(String(x._id)) ?? 0 })), meta: { page, limit, total, pages: Math.ceil(total / limit) } });
}));
clientsRouter.post('/', validate(createBody), asyncHandler(async (req, res) => {
  const { services, ...clientInput } = req.body;
  if (services.length) {
    const activeServices = await Service.countDocuments({ _id: { $in: services.map((row: { service: string }) => row.service) }, active: true });
    if (activeServices !== services.length) throw new AppError(422, 'One or more services are missing or inactive');
  }
  const client = await Client.create(clientInput);
  try {
    if (client.lifecycleStage === 'In Progress') await OnboardingChecklist.create({ client: client._id });
    if (services.length) await ClientService.insertMany(services.map((row: Record<string, unknown>) => ({ ...row, client: client._id })));
  } catch (error) {
    await Promise.all([ClientService.deleteMany({ client: client._id }), OnboardingChecklist.deleteMany({ client: client._id }), Client.deleteOne({ _id: client._id })]);
    throw error;
  }
  await audit({ actor: req.user?._id, action: 'CREATE', recordType: 'Client', recordId: client._id, after: { ...client.toObject(), services } });
  res.status(201).json({ success: true, data: { ...client.toObject(), services } });
}));
clientsRouter.get('/:id', validate(z.object({ id:objectId }).strict(), 'params'), asyncHandler(async (req, res) => {
  const client = await Client.findById(String(req.params.id)).populate('cstHandler closer','name email').lean(); if (!client) throw new AppError(404, 'Client not found');
  const [computed,onboarding,invoiceCount,contactCount,complaintCount,reportCount,upsellCount,recentInvoices] = await Promise.all([
    clientComputed(client),
    OnboardingChecklist.findOne({ client: client._id }).lean(),
    Invoice.countDocuments({ client: client._id }),
    Contact.countDocuments({ client: client._id }),
    Complaint.countDocuments({ client: client._id }),
    Report.countDocuments({ client: client._id }),
    Upsell.countDocuments({ client: client._id }),
    Invoice.find({ client: client._id }).sort({ dueDate: -1 }).limit(6).lean()
  ]);
  res.json({ success: true, data: { ...client, ...computed, onboarding, activitySummary: { invoices: invoiceCount, contacts: contactCount, complaints: complaintCount, reports: reportCount, upsells: upsellCount }, recentInvoices } });
}));

clientsRouter.get('/:id/history', validate(z.object({ id:objectId }).strict(), 'params'), asyncHandler(async (req, res) => {
  const client = await Client.findById(String(req.params.id)).select('_id').lean();
  if (!client) throw new AppError(404, 'Client not found');
  const items = await AuditLog.find({ recordId: String(client._id) }).populate('actor', 'name email role').sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, data: items });
}));
clientsRouter.patch('/:id', validate(z.object({ id:objectId }).strict(), 'params'), validate(z.object(bodyShape).partial().strict()), asyncHandler(async (req, res) => {
  const client = await Client.findById(String(req.params.id)); if (!client) throw new AppError(404, 'Client not found');
  if ('cstHandler' in req.body) {
    if (!['DIRECTOR', 'CST_MANAGER'].includes(req.user?.role ?? '')) throw new AppError(403, 'Only Directors and CST Managers may reassign clients');
    const targetHandler = await User.findById(req.body.cstHandler);
    if (!targetHandler?.active || !['CST_HANDLER', 'CST'].includes(targetHandler.role)) throw new AppError(422, 'Target must be an active CST Handler');
    if (String(client.cstHandler ?? '') === String(targetHandler._id)) throw new AppError(409, 'Client is already assigned to this Handler');
    if (req.user?.role === 'CST_MANAGER') {
      const currentHandler = client.cstHandler ? await User.findById(client.cstHandler) : null;
      if (!canReassignClient(req.user, targetHandler, currentHandler)) throw new AppError(403, 'Client and target Handler must belong to your team');
    }
  }
  const nextSaleDate = req.body.saleDate ?? client.saleDate;
  const nextWorkStartDate = req.body.workStartDate ?? client.workStartDate;
  const nextStage = req.body.lifecycleStage ?? client.lifecycleStage;
  const nextChurnDate = 'dateChurned' in req.body ? req.body.dateChurned : client.dateChurned;
  if (nextWorkStartDate < nextSaleDate) throw new AppError(422, 'workStartDate cannot precede saleDate');
  if (nextStage === 'Not Active' && !nextChurnDate) throw new AppError(422, 'dateChurned is required for Not Active clients');
  const before = client.toObject(); Object.assign(client, req.body); await client.save();
  if (client.lifecycleStage === 'In Progress') await OnboardingChecklist.updateOne({ client: client._id }, { $setOnInsert: { client: client._id } }, { upsert: true });
  const after = client.toObject();
  const changes = collectClientChanges(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>, Object.keys(req.body));
  await audit({ actor: req.user?._id, action: 'cstHandler' in req.body ? 'REASSIGN' : 'UPDATE', recordType: 'Client', recordId: client._id, before, after: { ...after, changes } });
  res.json({ success: true, data: client });
}));
clientsRouter.patch('/:id/assignment',
  allowRoles('DIRECTOR', 'CST_MANAGER'),
  validate(z.object({ id: objectId }).strict(), 'params'),
  validate(z.object({ cstHandler: objectId }).strict()),
  asyncHandler(async (req, res) => {
    const [client, targetHandler] = await Promise.all([
      Client.findById(String(req.params.id)),
      User.findById(req.body.cstHandler)
    ]);
    if (!client) throw new AppError(404, 'Client not found');
    if (!targetHandler?.active || !['CST_HANDLER', 'CST'].includes(targetHandler.role)) throw new AppError(422, 'Target must be an active CST Handler');
    if (String(client.cstHandler ?? '') === String(targetHandler._id)) throw new AppError(409, 'Client is already assigned to this Handler');

    if (req.user?.role === 'CST_MANAGER') {
      const currentHandler = client.cstHandler ? await User.findById(client.cstHandler) : null;
      if (!canReassignClient(req.user, targetHandler, currentHandler)) throw new AppError(403, 'Client and target Handler must belong to your team');
    }

    const previousHandler = client.cstHandler ?? null;
    client.cstHandler = targetHandler._id;
    await client.save();
    await audit({
      actor: req.user?._id,
      action: 'REASSIGN',
      recordType: 'Client',
      recordId: client._id,
      before: { cstHandler: previousHandler },
      after: { cstHandler: targetHandler._id }
    });
    await client.populate('cstHandler', 'name email role manager');
    res.json({ success: true, data: client });
  })
);
clientsRouter.delete('/:id', validate(z.object({ id:objectId }).strict(), 'params'), asyncHandler(async (req, res) => {
  const clientId = String(req.params.id);
  const history = await Promise.all([
    Invoice.exists({ client: clientId }), Contact.exists({ client: clientId }),
    Complaint.exists({ client: clientId }), Report.exists({ client: clientId }),
    Upsell.exists({ client: clientId })
  ]);
  if (history.some(Boolean)) throw new AppError(409, 'Client with operational history cannot be deleted; mark Not Active');
  const client = await Client.findByIdAndDelete(clientId); if (!client) throw new AppError(404, 'Client not found');
  await Promise.all([ClientService.deleteMany({ client: client._id }), OnboardingChecklist.deleteMany({ client: client._id })]);
  await audit({ actor: req.user?._id, action: 'DELETE', recordType: 'Client', recordId: client._id, before: client.toObject() });
  res.status(204).send();
}));
