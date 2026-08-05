import { db } from './schema';
import { uuid } from './campaigns';
import type { Template } from '@fanout/shared';
import type { TemplateInput } from '../messaging/channel';

/** Reusable subject+body template library (TICKET-017), stored locally. */

/** Create (no id) or overwrite (existing id) a template; returns the saved row. */
export async function saveTemplate(input: TemplateInput): Promise<Template> {
  const now = Date.now();
  const existing = input.id ? await db.templates.get(input.id) : undefined;
  const tpl: Template = {
    id: input.id ?? uuid(),
    name: input.name.trim() || 'Untitled template',
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    bodyText: input.bodyText,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.templates.put(tpl);
  return tpl;
}

export async function listTemplates(): Promise<Template[]> {
  return db.templates.orderBy('updatedAt').reverse().toArray();
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.templates.delete(id);
}
