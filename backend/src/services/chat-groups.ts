import { ChatMessage } from '../models/ChatMessage.js';
import { ChatThread } from '../models/ChatThread.js';
import { User } from '../models/User.js';

export const standingGroups = ['Onboarding', 'Active', 'Non-active', 'Upsells'] as const;

export function groupForClientStage(stage: string) {
  if (stage === 'Active') return 'Active';
  if (stage === 'Not Active') return 'Non-active';
  return 'Onboarding';
}

async function allActiveUserIds() {
  const users = await User.find({ active: true }).select('_id').lean();
  return users.map((user) => user._id);
}

export async function ensureStandingGroups() {
  const members = await allActiveUserIds();
  await Promise.all(standingGroups.map((name) => ChatThread.updateOne(
    { type: 'GROUP', name },
    { $set: { members }, $setOnInsert: { name, type: 'GROUP', latest: '', lastMessageAt: new Date() } },
    { upsert: true }
  )));
}

export async function postClientStageChangeCard({
  actor,
  client,
  fromStage,
  toStage
}: {
  actor?: unknown;
  client: { _id: unknown; businessName: string; customerName?: string; cstHandler?: unknown };
  fromStage: string;
  toStage: string;
}) {
  if (!actor) return;
  await ensureStandingGroups();
  const groupName = groupForClientStage(toStage);
  const [thread, handler] = await Promise.all([
    ChatThread.findOne({ type: 'GROUP', name: groupName }),
    client.cstHandler ? User.findById(client.cstHandler).select('name').lean() : null
  ]);
  if (!thread) return;
  const clientId = String(client._id);
  const body = `${client.businessName} moved from ${fromStage} to ${toStage}`;
  const row = await ChatMessage.create({
    thread: thread._id,
    sender: actor,
    body,
    cardType: 'CLIENT_CARD',
    metadata: {
      event: 'Status changed',
      badge: groupName,
      client: client.businessName,
      customer: client.customerName ?? '',
      handler: handler?.name ?? 'Unassigned',
      fromStatus: fromStage,
      toStatus: toStage,
      clientId,
      detailUrl: `/clients/${clientId}`,
      actionLabel: 'View detail'
    }
  });
  thread.latest = body;
  thread.lastMessageAt = new Date();
  await thread.save();
  return row;
}
