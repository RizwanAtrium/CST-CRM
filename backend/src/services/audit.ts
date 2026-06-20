import { AuditLog } from '../models/AuditLog.js';

export async function audit(input: { actor?: unknown; action: string; recordType: string; recordId?: unknown; before?: unknown; after?: unknown; source?: 'HUMAN'|'SYSTEM' }) {
  await AuditLog.create({ ...input, actor: input.actor, recordId: input.recordId ? String(input.recordId) : undefined, source: input.source ?? 'HUMAN' });
}
