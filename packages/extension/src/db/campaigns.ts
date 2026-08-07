import { db } from './schema';
import type {
  Campaign,
  Recipient,
  RecipientStatus,
  SendLog,
} from '@fanout/shared';
import { DEFAULT_THROTTLE } from '@fanout/shared';

export function uuid(): string {
  return crypto.randomUUID();
}

/** Create a fresh draft campaign from the compose contents. */
export async function createDraftCampaign(input: {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  fromEmail: string;
  fromName: string;
}): Promise<Campaign> {
  const now = Date.now();
  const campaign: Campaign = {
    id: uuid(),
    name: deriveName(input.subject),
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    bodyText: input.bodyText,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    tokenSchema: [],
    columnMappings: [],
    headers: [],
    status: 'draft',
    pauseReason: null,
    accountError: null,
    scheduledAt: null,
    throttle: { ...DEFAULT_THROTTLE },
    dailyCap: null,
    totalRecipients: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  await db.campaigns.add(campaign);
  return campaign;
}

function deriveName(subject: string): string {
  const trimmed = subject.trim();
  if (trimmed) return trimmed.slice(0, 80);
  // No subject captured — fall back to a dated name so runs stay distinguishable
  // in the Recent list instead of a wall of identical "Untitled campaign".
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `Campaign — ${date}, ${time}`;
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  return db.campaigns.get(id);
}

export async function updateCampaign(
  id: string,
  patch: Partial<Campaign>,
): Promise<void> {
  await db.campaigns.update(id, { ...patch, updatedAt: Date.now() });
}

export async function listCampaigns(): Promise<Campaign[]> {
  return db.campaigns.orderBy('updatedAt').reverse().toArray();
}

/** Delete a campaign and cascade to its recipients + logs, in one transaction. */
export async function deleteCampaign(id: string): Promise<void> {
  await db.transaction('rw', db.campaigns, db.recipients, db.sendLogs, async () => {
    await db.recipients.where('campaignId').equals(id).delete();
    await db.sendLogs.where('campaignId').equals(id).delete();
    await db.campaigns.delete(id);
  });
}

/** Replace all recipients for a campaign (used on (re)import). */
export async function replaceRecipients(
  campaignId: string,
  recipients: Recipient[],
): Promise<void> {
  await db.transaction('rw', db.recipients, db.campaigns, async () => {
    await db.recipients.where('campaignId').equals(campaignId).delete();
    await db.recipients.bulkAdd(recipients);
    await recomputeCounts(campaignId);
  });
}

export async function listRecipients(campaignId: string): Promise<Recipient[]> {
  return db.recipients.where('campaignId').equals(campaignId).toArray();
}

export async function countByStatus(
  campaignId: string,
): Promise<Record<RecipientStatus, number>> {
  const rows = await db.recipients.where('campaignId').equals(campaignId).toArray();
  const counts: Record<RecipientStatus, number> = {
    pending: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };
  for (const r of rows) counts[r.status]++;
  return counts;
}

/** Recompute denormalized counters on the campaign row from recipient rows. */
export async function recomputeCounts(campaignId: string): Promise<void> {
  const counts = await countByStatus(campaignId);
  const total =
    counts.pending +
    counts.sending +
    counts.sent +
    counts.failed +
    counts.skipped;
  await db.campaigns.update(campaignId, {
    totalRecipients: total,
    sentCount: counts.sent,
    failedCount: counts.failed,
    skippedCount: counts.skipped,
    updatedAt: Date.now(),
  });
}

export async function appendSendLog(log: SendLog): Promise<void> {
  await db.sendLogs.add(log);
}

export async function listSendLogs(campaignId: string): Promise<SendLog[]> {
  return db.sendLogs.where('campaignId').equals(campaignId).sortBy('timestamp');
}
