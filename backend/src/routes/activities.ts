import { Router } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { Client } from '../models/Client.js';
import { visibleClientIds } from '../services/visibility.js';
import { asyncHandler } from '../utils/async-handler.js';

export const activitiesRouter = Router();

activitiesRouter.get('/', asyncHandler(async (req, res) => {
  const scopedIds = await visibleClientIds(req.user);
  const filter = scopedIds === null ? {} : {
    $or: [
      { recordType: 'Client', recordId: { $in: scopedIds.map(String) } },
      { 'before.client': { $in: scopedIds } },
      { 'after.client': { $in: scopedIds } }
    ]
  };
  const rows = await AuditLog.find(filter).populate('actor', 'name').sort({ createdAt: -1 }).limit(20).lean();
  const clientIds = rows.filter((row) => row.recordType === 'Client').map((row) => row.recordId);
  const clients = await Client.find({ _id: { $in: clientIds } }).select('businessName').lean();
  const names = new Map(clients.map((client) => [String(client._id), client.businessName]));

  res.json({
    success: true,
    data: rows.map((row) => ({
      id: String(row._id),
      client: row.recordType === 'Client' ? names.get(String(row.recordId)) ?? 'Client' : row.recordType,
      kind: row.action === 'REASSIGN' ? 'Assignment' : row.recordType,
      date: String(row.createdAt),
      status: row.action === 'DELETE' ? 'Resolved' : 'In Progress',
      owner: row.actor && typeof row.actor === 'object' && 'name' in row.actor ? String(row.actor.name) : 'System',
      detail: `${row.action.toLowerCase()} ${row.recordType.toLowerCase()}`
    }))
  });
}));
