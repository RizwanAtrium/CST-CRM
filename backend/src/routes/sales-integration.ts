import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { validate } from '../middleware/validate.js';
import { Client } from '../models/Client.js';
import { ClientService } from '../models/ClientService.js';
import { OnboardingChecklist } from '../models/OnboardingChecklist.js';
import { Service } from '../models/Service.js';
import { User } from '../models/User.js';
import { audit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
const party = z.object({
  name: z.string().trim().min(1),
  email: z.string().email().optional().or(z.literal('')),
}).strict();

const handoffBody = z.object({
  handoffId: z.string().trim().min(1).max(120),
  opportunityId: z.string().trim().min(1).max(120),
  customer: z.object({
    businessName: z.string().trim().min(1),
    customerName: z.string().trim().optional(),
    phoneNumber: z.string().trim().optional(),
    mobileNumber: z.string().trim().optional(),
    email: z.string().email().optional().or(z.literal('')),
    businessAddress: z.string().trim().optional(),
    state: z.string().trim().optional(),
    country: z.string().trim().optional(),
  }).strict(),
  services: z.array(z.object({
    name: z.string().trim().min(1),
    amount: z.number().nonnegative(),
  }).strict()).min(1).max(50),
  saleDate: z.coerce.date(),
  paidAt: z.coerce.date(),
  workStartDate: z.coerce.date().optional(),
  totalDealValue: z.number().nonnegative(),
  amountReceived: z.number().nonnegative(),
  closer: party,
  teamLead: party.optional(),
  manager: party.optional(),
  cstHandlerId: objectId.optional(),
}).strict().refine(
  (value) => new Set(value.services.map((service) => service.name.toLowerCase())).size === value.services.length,
  { message: 'Duplicate service names are not allowed' },
);

function requireIntegrationKey(value: string | undefined) {
  if (!value) throw new AppError(401, 'Integration key required');
  const provided = Buffer.from(value);
  const expected = Buffer.from(env.CST_INTEGRATION_SECRET || env.SALES_CRM_INTEGRATION_SECRET);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new AppError(401, 'Invalid integration key');
  }
}

export const salesIntegrationRouter = Router();

salesIntegrationRouter.use((req, _res, next) => {
  requireIntegrationKey(req.header('x-integration-key'));
  next();
});

salesIntegrationRouter.get('/handlers', asyncHandler(async (_req, res) => {
  const handlers = await User.find({ role: { $in: ['CST_HANDLER', 'CST'] }, active: true })
    .select('name email manager')
    .sort({ name: 1 })
    .lean();
  const loads = await Client.aggregate([
    { $match: { lifecycleStage: { $in: ['In Progress', 'Active'] }, cstHandler: { $ne: null } } },
    { $group: { _id: '$cstHandler', activeClients: { $sum: 1 } } },
  ]);
  const loadMap = new Map(loads.map((row) => [String(row._id), row.activeClients]));
  res.json({
    success: true,
    data: handlers.map((handler) => ({
      id: String(handler._id),
      name: handler.name,
      email: handler.email,
      managerId: handler.manager ? String(handler.manager) : null,
      activeClients: loadMap.get(String(handler._id)) ?? 0,
    })),
  });
}));

salesIntegrationRouter.post('/handoffs', validate(handoffBody), asyncHandler(async (req, res) => {
  const input = req.body as z.infer<typeof handoffBody>;
  const existing = await Client.findOne({ sourceSystem: 'SALES_CRM', sourceReference: input.handoffId }).lean();
  if (existing) {
    return res.json({ success: true, data: { created: false, clientId: String(existing._id), lifecycleStage: existing.lifecycleStage } });
  }

  if (input.cstHandlerId) {
    const handler = await User.findOne({ _id: input.cstHandlerId, role: { $in: ['CST_HANDLER', 'CST'] }, active: true });
    if (!handler) throw new AppError(422, 'CST handler is missing or inactive');
  }

  const services = await Promise.all(input.services.map((line) =>
    Service.findOneAndUpdate(
      { name: line.name },
      { $set: { active: true }, $setOnInsert: { name: line.name } },
      { upsert: true, new: true },
    ),
  ));

  const client = await Client.create({
    businessName: input.customer.businessName,
    customerName: input.customer.customerName,
    contactNumber: input.customer.phoneNumber || input.customer.mobileNumber,
    email: input.customer.email,
    address: input.customer.businessAddress,
    state: input.customer.state,
    country: input.customer.country,
    cstHandler: input.cstHandlerId,
    saleDate: input.saleDate,
    workStartDate: input.workStartDate ?? input.paidAt,
    lifecycleStage: 'In Progress',
    sourceSystem: 'SALES_CRM',
    sourceReference: input.handoffId,
    salesOpportunityId: input.opportunityId,
    salesDealValue: input.totalDealValue,
    salesAmountReceived: input.amountReceived,
    salesPaidAt: input.paidAt,
    salesCloserName: input.closer.name,
    salesCloserEmail: input.closer.email,
  });

  try {
    await Promise.all([
      OnboardingChecklist.create({ client: client._id }),
      ClientService.insertMany(input.services.map((line, index) => ({
        client: client._id,
        service: services[index]!._id,
        monthlyAmount: line.amount,
        active: true,
      }))),
    ]);
  } catch (error) {
    await Promise.all([
      ClientService.deleteMany({ client: client._id }),
      OnboardingChecklist.deleteMany({ client: client._id }),
      Client.deleteOne({ _id: client._id }),
    ]);
    throw error;
  }

  await audit({
    action: 'SALES_CRM_HANDOFF',
    recordType: 'Client',
    recordId: client._id,
    source: 'SYSTEM',
    after: { handoffId: input.handoffId, opportunityId: input.opportunityId, services: input.services },
  });

  res.status(201).json({
    success: true,
    data: { created: true, clientId: String(client._id), lifecycleStage: client.lifecycleStage },
  });
}));
