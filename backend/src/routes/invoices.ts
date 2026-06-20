import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { allowRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { generateInvoices } from '../jobs/invoices.js';
import { Invoice } from '../models/Invoice.js';
import { audit } from '../services/audit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { daysBeforeDue, derivedInvoiceStatus, invoiceTiming } from '../utils/dates.js';
import { AppError } from '../utils/errors.js';
import { pagination } from '../utils/pagination.js';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
const idParams = z.object({ id: objectId }).strict();
const listQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  client: objectId.optional(),
  status: z.enum(['Not Sent', 'Sent', 'Late']).optional(),
  paid: z.enum(['true', 'false']).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional()
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, { message: 'from must be on or before to' });
const computed = (row: { dueDate: Date; sentDate?: Date|null }) => ({
  status: derivedInvoiceStatus(row.dueDate, row.sentDate),
  daysBeforeDue: daysBeforeDue(row.dueDate, row.sentDate),
  timing: invoiceTiming(row.dueDate, row.sentDate)
});
export const invoicesRouter = Router();
invoicesRouter.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req); const filter: Record<string, unknown> = {};
  if (req.query.month) filter.billingMonth = req.query.month;
  if (req.query.client) filter.client = req.query.client;
  if (req.query.paid !== undefined) filter.paid = req.query.paid === 'true';
  if (req.query.status === 'Sent') {
    filter.sentDate = { $ne: null };
    filter.$expr = { $lt: ['$sentDate', '$dueDate'] };
  } else if (req.query.status === 'Not Sent') {
    filter.sentDate = null;
    filter.dueDate = { $gte: new Date(new Date().setHours(0, 0, 0, 0)) };
  } else if (req.query.status === 'Late') {
    filter.$or = [
      { sentDate: null, dueDate: { $lt: new Date(new Date().setHours(0, 0, 0, 0)) } },
      { sentDate: { $ne: null }, $expr: { $gte: ['$sentDate', '$dueDate'] } }
    ];
  }
  if (req.query.from || req.query.to) {
    const range = {
      ...(req.query.from ? { $gte: new Date(`${req.query.from}T00:00:00`) } : {}),
      ...(req.query.to ? { $lte: new Date(`${req.query.to}T23:59:59.999`) } : {})
    };
    filter.dueDate = { ...((filter.dueDate as Record<string, unknown> | undefined) ?? {}), ...range };
  }
  const [rows,total] = await Promise.all([Invoice.find(filter).populate('client','businessName customerName').sort({ dueDate: -1 }).skip(skip).limit(limit).lean(), Invoice.countDocuments(filter)]);
  const data = rows.map((row) => ({ ...row, ...computed(row) }));
  res.json({ success: true, data, meta: { page, limit, total, pages: Math.ceil(total/limit) } });
}));
invoicesRouter.get('/revenue-history', asyncHandler(async (_req, res) => {
  const rows = await Invoice.aggregate([{ $group: { _id: '$billingMonth', invoiced: { $sum: '$amount' }, paid: { $sum: { $cond: ['$paid','$amount',0] } }, outstanding: { $sum: { $cond: ['$paid',0,'$amount'] } } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, month: '$_id', invoiced: 1, paid: 1, outstanding: 1 } }]);
  res.json({ success: true, data: rows });
}));
invoicesRouter.get('/summary', validate(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), client: objectId.optional() }).strict(), 'query'), asyncHandler(async (req, res) => {
  const match: Record<string, unknown> = { billingMonth: req.query.month };
  if (req.query.client) match.client = new Types.ObjectId(String(req.query.client));
  const [summary] = await Invoice.aggregate([
    { $match: match },
    { $group: {
      _id: null,
      count: { $sum: 1 },
      invoiced: { $sum: '$amount' },
      paid: { $sum: { $cond: ['$paid', '$amount', 0] } },
      outstanding: { $sum: { $cond: ['$paid', 0, '$amount'] } }
    } }
  ]);
  res.json({ success: true, data: { month: req.query.month, count: summary?.count ?? 0, invoiced: summary?.invoiced ?? 0, paid: summary?.paid ?? 0, outstanding: summary?.outstanding ?? 0 } });
}));
invoicesRouter.post('/generate', allowRoles('DIRECTOR'), validate(z.object({ date: z.coerce.date().optional(), force: z.boolean().default(false) }).strict()), asyncHandler(async (req, res) => res.json({ success: true, data: await generateInvoices(req.body.date ?? new Date(), req.body.force) })));
invoicesRouter.get('/:id', validate(idParams, 'params'), asyncHandler(async (req, res) => { const row = await Invoice.findById(String(req.params.id)).populate('client'); if (!row) throw new AppError(404,'Invoice not found'); res.json({ success: true, data: { ...row.toObject(), ...computed(row) } }); }));
invoicesRouter.patch('/:id', validate(idParams, 'params'), validate(z.object({ sentDate: z.coerce.date().nullable().optional(), paid: z.boolean().optional(), paidDate: z.coerce.date().nullable().optional() }).strict().refine((value) => value.paid !== true || value.paidDate != null, { message: 'paidDate is required when paid is true', path: ['paidDate'] })), asyncHandler(async (req, res) => {
  const row = await Invoice.findById(String(req.params.id)); if (!row) throw new AppError(404,'Invoice not found'); const before = row.toObject();
  if ('sentDate' in req.body) row.sentDate = req.body.sentDate; if ('paid' in req.body) row.paid = req.body.paid; if ('paidDate' in req.body) row.paidDate = req.body.paidDate;
  row.status = derivedInvoiceStatus(row.dueDate, row.sentDate); await row.save();
  await audit({ actor: req.user?._id, action: 'UPDATE', recordType: 'Invoice', recordId: row._id, before, after: row.toObject() }); res.json({ success: true, data: { ...row.toObject(), ...computed(row) } });
}));
